import { prisma } from '../lib/prisma';
import { getMarketData, getTokenIdForOutcome, createOrder, submitOrder } from '../lib/polymarket';
import {
  mockExecuteOrder,
  isMockMode,
  MockMarketInfo,
} from '../lib/mockExecution';
import {
  BotConfig,
  SignalType,
  SIGNAL_TYPES,
  ORDER_SIDES,
  OUTCOMES,
  decryptPrivateKey,
  Outcome,
  OrderSide,
} from '@botmarket/shared';
import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

const metricsQueue = new Queue('metrics-update', {
  connection: redis,
});

// ============================================================================
// Types
// ============================================================================

interface TradeSignalJob {
  botId: string;
  signal: SignalType;
  parsedSignal?: any;
  timestamp?: string;
  test?: boolean;
}

// ============================================================================
// Console Logging Colors
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logSignalReceived(botId: string, signal: SignalType): void {
  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}📥 SIGNAL RECEIVED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Signal:${COLORS.reset} ${COLORS.bright}${signal}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Time:${COLORS.reset}   ${new Date().toISOString()}`);
}

function logRiskCheckFailed(botId: string, reason: string): void {
  console.log(`${COLORS.yellow}⚠️  RISK CHECK FAILED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Reason:${COLORS.reset} ${reason}`);
  console.log('');
}

function logError(botId: string, error: string): void {
  console.log(`${COLORS.red}❌ ERROR${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Error:${COLORS.reset}  ${error}`);
  console.log('');
}

function logTradeComplete(botId: string, signal: SignalType, side: string, outcome: string): void {
  console.log(`${COLORS.bright}${COLORS.green}✅ TRADE COMPLETE${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Signal:${COLORS.reset} ${signal} → ${side} ${outcome}`);
  console.log('');
}

// ============================================================================
// Risk Rules
// ============================================================================

/**
 * Check if bot can trade based on risk rules.
 * Uses the bot's internal Prisma ID for database queries.
 */
async function checkRiskRules(
  botPrismaId: string,
  botExternalId: string,
  config: BotConfig
): Promise<{ allowed: boolean; reason?: string }> {
  // Check cooldown - query using external botId that matches the Order.botId field
  const lastOrder = await prisma.order.findFirst({
    where: { botId: botExternalId },
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
      botId: botExternalId,
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
      botId: botExternalId,
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

// ============================================================================
// Main Trade Signal Processor
// ============================================================================

/**
 * Process a trade signal from the queue.
 * 
 * Flow:
 * 1. Load bot configuration
 * 2. Apply risk rules
 * 3. Determine trade action from signal
 * 4. Discover current market
 * 5. Execute order (mock or live based on ENABLE_LIVE_TRADING)
 * 6. Store results in database
 * 7. Trigger metrics update
 */
export async function processTradeSignal(jobData: TradeSignalJob): Promise<void> {
  const { botId, signal, timestamp } = jobData;
  const mockMode = isMockMode();

  logSignalReceived(botId, signal);

  try {
    // ========================================================================
    // Step 1: Load bot and config
    // ========================================================================
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

    // ========================================================================
    // Step 2: Handle CLOSE signal
    // ========================================================================
    if (signal === SIGNAL_TYPES.CLOSE) {
      // TODO: Implement position closing logic
      // For now, just log the signal
      console.log(`${COLORS.yellow}📤 CLOSE signal received for bot ${botId}${COLORS.reset}`);
      console.log(`${COLORS.dim}   Position closing not yet implemented${COLORS.reset}`);
      return;
    }

    // ========================================================================
    // Step 3: Check risk rules
    // ========================================================================
    const riskCheck = await checkRiskRules(bot.id, bot.botId, config);
    if (!riskCheck.allowed) {
      logRiskCheckFailed(botId, riskCheck.reason!);
      return;
    }

    // ========================================================================
    // Step 4: Map signal to trade action
    // ========================================================================
    const signalMap = config.webhook.signalMap;
    let tradeAction;
    
    if (signal === SIGNAL_TYPES.LONG) {
      tradeAction = signalMap.LONG;
    } else if (signal === SIGNAL_TYPES.SHORT) {
      tradeAction = signalMap.SHORT;
    } else {
      throw new Error(`Unknown signal type: ${signal}`);
    }

    const side = tradeAction.side as OrderSide;
    const outcome = tradeAction.outcome as Outcome;

    // ========================================================================
    // Step 5: Discover current market
    // ========================================================================
    const { getCurrentMarketId } = await import('@botmarket/shared');
    let marketId = await getCurrentMarketId(config.market.currency, config.market.timeframe);
    
    // If market discovery fails, generate a mock market ID for demo purposes
    if (!marketId) {
      if (mockMode) {
        // Generate deterministic mock market ID for demo
        const dateStr = new Date().toISOString().split('T')[0];
        marketId = `mock_${config.market.currency.toLowerCase()}_${config.market.timeframe}_${dateStr}`;
        console.log(`${COLORS.yellow}⚠️  Market not found, using mock market ID: ${marketId}${COLORS.reset}`);
      } else {
        throw new Error(`Could not find current market for ${config.market.currency} ${config.market.timeframe}`);
      }
    }

    // Calculate order size
    const sizeUsd = config.sizing.type === 'fixed_usd' ? config.sizing.value : 25; // Default $25

    // ========================================================================
    // Step 6: Execute order (Mock or Live)
    // ========================================================================
    if (mockMode) {
      // ======================================================================
      // MOCK EXECUTION PATH
      // ======================================================================
      const marketInfo: MockMarketInfo = {
        marketId,
        marketSlug: `${config.market.currency.toLowerCase()}-${config.market.timeframe}`,
        currency: config.market.currency,
        timeframe: config.market.timeframe,
      };

      await mockExecuteOrder({
        botId: bot.id,
        botIdExternal: bot.botId,
        side,
        outcome,
        sizeUsd,
        marketInfo,
      });

      logTradeComplete(botId, signal, side, outcome);

    } else {
      // ======================================================================
      // LIVE EXECUTION PATH
      // TODO: This path requires real Polymarket integration
      // ======================================================================
      console.log(`${COLORS.bright}${COLORS.magenta}🔴 LIVE TRADING MODE${COLORS.reset}`);
      
      // Get market data from Polymarket
      const market = await getMarketData(marketId);
      if (!market) {
        throw new Error(`Market ${marketId} not found on Polymarket`);
      }

      // Get token ID for outcome
      const tokenId = getTokenIdForOutcome(market, outcome);
      if (!tokenId) {
        throw new Error(`Token ID not found for outcome ${outcome}`);
      }

      // TODO: Get current market price for limit orders
      const price = 0.5; // Placeholder - should fetch from market

      // Create order (requires bot key)
      const botKey = bot.keys[0];
      if (!botKey) {
        throw new Error(`Bot ${botId} has no trading key configured`);
      }

      const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET;
      if (!encryptionSecret) {
        throw new Error('BOT_KEY_ENCRYPTION_SECRET not configured');
      }

      // Decrypt private key (for live trading - use with caution)
      const privateKey = decryptPrivateKey(botKey.encryptedPrivKey, encryptionSecret);

      const order = await createOrder(tokenId, side, price, sizeUsd, privateKey);
      if (!order) {
        throw new Error('Failed to create order');
      }

      // Store order in database
      const dbOrder = await prisma.order.create({
        data: {
          botId: bot.botId,
          marketId,
          outcome,
          side,
          price,
          size: sizeUsd,
          status: 'PENDING',
          tokenId,
        },
      });

      // Submit order to Polymarket (if API credentials available)
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
        console.log(`${COLORS.yellow}⚠️  Polymarket API credentials not configured${COLORS.reset}`);
        console.log(`${COLORS.dim}   Order stored but not submitted to Polymarket${COLORS.reset}`);
      }

      logTradeComplete(botId, signal, side, outcome);
    }

    // ========================================================================
    // Step 7: Trigger metrics update
    // ========================================================================
    await metricsQueue.add('update-metrics', {
      botId,
    });

  } catch (error: any) {
    logError(botId, error.message);
    throw error;
  }
}
