import { prisma } from '../lib/prisma';
import { getMarketData, getTokenIdForOutcome, createOrder, submitOrder } from '../lib/polymarket';
import {
  BotConfig,
  SignalType,
  SIGNAL_TYPES,
  ORDER_SIDES,
  OUTCOMES,
  decryptPrivateKey,
} from '@botmarket/shared';
import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

const metricsQueue = new Queue('metrics-update', {
  connection: redis,
});

interface TradeSignalJob {
  botId: string;
  signal: SignalType;
  parsedSignal?: any;
  timestamp?: string;
  test?: boolean;
}

/**
 * Check if bot can trade based on risk rules
 */
async function checkRiskRules(botId: string, config: BotConfig): Promise<{ allowed: boolean; reason?: string }> {
  // Check cooldown
  const lastOrder = await prisma.order.findFirst({
    where: { botId },
    orderBy: { placedAt: 'desc' },
  });

  if (lastOrder) {
    const cooldownMs = config.risk.cooldownMinutes * 60 * 1000;
    const timeSinceLastTrade = Date.now() - lastOrder.placedAt.getTime();
    
    if (timeSinceLastTrade < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastTrade) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active. Wait ${remainingMinutes} more minutes.`,
      };
    }
  }

  // Check max trades per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tradesToday = await prisma.order.count({
    where: {
      botId,
      placedAt: {
        gte: today,
      },
    },
  });

  if (tradesToday >= config.risk.maxTradesPerDay) {
    return {
      allowed: false,
      reason: `Max trades per day (${config.risk.maxTradesPerDay}) reached.`,
    };
  }

  // Check max position size
  const openOrders = await prisma.order.findMany({
    where: {
      botId,
      status: {
        in: ['PENDING', 'PARTIALLY_FILLED'],
      },
    },
  });

  const totalPositionUsd = openOrders.reduce((sum, order) => {
    return sum + (order.price * order.size);
  }, 0);

  const newTradeSize = config.sizing.type === 'fixed_usd' 
    ? config.sizing.value 
    : 0; // TODO: Calculate percentage-based sizing

  if (totalPositionUsd + newTradeSize > config.risk.maxPositionUsd) {
    return {
      allowed: false,
      reason: `Max position size ($${config.risk.maxPositionUsd}) would be exceeded.`,
    };
  }

  return { allowed: true };
}

/**
 * Process a trade signal
 */
export async function processTradeSignal(jobData: TradeSignalJob): Promise<void> {
  const { botId, signal, timestamp } = jobData;

  try {
    // Get bot and config
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        keys: {
          take: 1,
        },
      },
    });

    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    const config = bot.configs[0]?.configJSON as BotConfig;
    if (!config) {
      throw new Error(`Bot ${botId} has no configuration`);
    }

    // Handle CLOSE signal
    if (signal === SIGNAL_TYPES.CLOSE) {
      // Close all open positions
      // TODO: Implement position closing logic
      console.log(`CLOSE signal received for bot ${botId} - closing positions`);
      return;
    }

    // Check risk rules
    const riskCheck = await checkRiskRules(bot.id, config);
    if (!riskCheck.allowed) {
      console.log(`Risk check failed for bot ${botId}: ${riskCheck.reason}`);
      return;
    }

    // Map signal to trade action
    const signalMap = config.webhook.signalMap;
    let tradeAction;
    
    if (signal === SIGNAL_TYPES.LONG) {
      tradeAction = signalMap.LONG;
    } else if (signal === SIGNAL_TYPES.SHORT) {
      tradeAction = signalMap.SHORT;
    } else {
      throw new Error(`Unknown signal type: ${signal}`);
    }

    // Get current market ID using market discovery
    const { getCurrentMarketId } = await import('@botmarket/shared');
    const marketId = await getCurrentMarketId(config.market.currency, config.market.timeframe);
    
    if (!marketId) {
      throw new Error(`Could not find current market for ${config.market.currency} ${config.market.timeframe}`);
    }
    
    // Get market data
    const market = await getMarketData(marketId);
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    // Get token ID for outcome
    const outcome = tradeAction.outcome as Outcome;
    const tokenId = getTokenIdForOutcome(market, outcome);
    if (!tokenId) {
      throw new Error(`Token ID not found for outcome ${outcome}`);
    }

    // Calculate order size and price
    const sizeUsd = config.sizing.type === 'fixed_usd' ? config.sizing.value : 0;
    // TODO: Get current market price for limit orders
    const price = 0.5; // Placeholder - should fetch from market

    // Create order
    const botKey = bot.keys[0];
    if (!botKey) {
      throw new Error(`Bot ${botId} has no trading key configured`);
    }

    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      throw new Error('BOT_KEY_ENCRYPTION_SECRET not configured');
    }

    // Decrypt private key (for MVP - use with caution)
    const privateKey = decryptPrivateKey(botKey.encryptedPrivKey, encryptionSecret);

    const side = tradeAction.side as OrderSide;
    const order = await createOrder(tokenId, side, price, sizeUsd, privateKey);
    
    if (!order) {
      throw new Error('Failed to create order');
    }

    // Store order in database
    const dbOrder = await prisma.order.create({
      data: {
        botId: bot.id,
        marketId: marketId, // Use discovered market ID
        outcome,
        side,
        price,
        size: sizeUsd,
        status: 'PENDING',
        tokenId,
      },
    });

    // Submit order to Polymarket (if API credentials available)
    // TODO: Get API credentials from bot config or separate storage
    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const apiPassphrase = process.env.POLYMARKET_API_PASSPHRASE;

    if (apiKey && apiSecret && apiPassphrase) {
      const orderId = await submitOrder(order, apiKey, apiSecret, apiPassphrase);
      if (orderId) {
        await prisma.order.update({
          where: { id: dbOrder.id },
          data: { orderId },
        });
      }
    } else {
      console.log('Polymarket API credentials not configured - order stored but not submitted');
    }

    // Trigger metrics update
    await metricsQueue.add('update-metrics', {
      botId,
    });

    console.log(`Trade signal processed for bot ${botId}: ${signal} -> ${side} ${outcome}`);
  } catch (error: any) {
    console.error(`Error processing trade signal for bot ${botId}:`, error);
    throw error;
  }
}

