import { prisma } from '../lib/prisma';
import { getMarketData, getTokenIdForOutcome, submitOrderToPolymarket } from '../lib/polymarket';
import {
  mockExecuteOrder,
  MockMarketInfo,
} from '../lib/mockExecution';
import {
  getTradingConfig,
  isLiveMode,
  checkTradeSizeCap,
  checkDailyNotionalCap,
  validateLiveTradingConfig,
  TradingConfig,
} from '../lib/tradingConfig';
import {
  signPolymarketOrder,
  PolymarketOrderInput,
  OrderSide as PolymarketOrderSide,
} from '../lib/polymarketSigning';
import {
  BotConfig,
  SignalType,
  SIGNAL_TYPES,
  ORDER_SIDES,
  OUTCOMES,
  decryptPrivateKey,
  Outcome,
  OrderSide,
  ORDER_STATUS,
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

function logSignalReceived(botId: string, signal: SignalType, mode: string): void {
  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}📥 SIGNAL RECEIVED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Signal:${COLORS.reset} ${COLORS.bright}${signal}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Mode:${COLORS.reset}   ${mode.toUpperCase()}`);
  console.log(`${COLORS.cyan}   Time:${COLORS.reset}   ${new Date().toISOString()}`);
}

function logRiskCheckFailed(botId: string, reason: string): void {
  console.log(`${COLORS.yellow}⚠️  RISK CHECK FAILED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Reason:${COLORS.reset} ${reason}`);
  console.log('');
}

function logSafetyCapViolation(botId: string, type: string, message: string): void {
  console.log(`${COLORS.bright}${COLORS.yellow}⚠️  SAFETY CAP VIOLATION - SKIPPING LIVE TRADE${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}       ${botId}`);
  console.log(`${COLORS.cyan}   Cap Type:${COLORS.reset}  ${type}`);
  console.log(`${COLORS.cyan}   Details:${COLORS.reset}   ${message}`);
  console.log('');
}

function logError(botId: string, error: string): void {
  console.log(`${COLORS.red}❌ ERROR${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Error:${COLORS.reset}  ${error}`);
  console.log('');
}

function logTradeComplete(botId: string, signal: SignalType, side: string, outcome: string, mode: string): void {
  console.log(`${COLORS.bright}${COLORS.green}✅ TRADE COMPLETE${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}    ${botId}`);
  console.log(`${COLORS.cyan}   Signal:${COLORS.reset} ${signal} → ${side} ${outcome}`);
  console.log(`${COLORS.cyan}   Mode:${COLORS.reset}   ${mode.toUpperCase()}`);
  console.log('');
}

function logLiveOrderSubmitted(orderId: string, mode: string): void {
  console.log(`${COLORS.bright}${COLORS.magenta}🔴 LIVE ORDER SUBMITTED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Order ID:${COLORS.reset} ${orderId}`);
  console.log(`${COLORS.cyan}   Mode:${COLORS.reset}     ${mode.toUpperCase()}`);
}

// ============================================================================
// Safety Cap Helpers
// ============================================================================

/**
 * Calculate the total notional traded by a bot in the last 24 hours.
 */
async function getDailyNotionalForBot(botExternalId: string): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const orders = await prisma.order.findMany({
    where: {
      botId: botExternalId,
      placedAt: {
        gte: twentyFourHoursAgo,
      },
    },
    select: {
      size: true,
    },
  });
  
  return orders.reduce((sum, order) => sum + order.size, 0);
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
 * 1. Load bot configuration and trading mode
 * 2. Apply risk rules
 * 3. For live modes (gamma/mainnet): check safety caps
 * 4. Determine trade action from signal
 * 5. Discover current market
 * 6. Execute order (mock, gamma, or mainnet based on TRADING_MODE)
 * 7. Store results in database
 * 8. Trigger metrics update
 */
export async function processTradeSignal(jobData: TradeSignalJob): Promise<void> {
  const { botId, signal, timestamp } = jobData;
  const tradingConfig = getTradingConfig();
  const { mode } = tradingConfig;

  logSignalReceived(botId, signal, mode);

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
    // Step 4: Calculate order size and check safety caps (for live modes)
    // ========================================================================
    const sizeUsd = config.sizing.type === 'fixed_usd' ? config.sizing.value : 25;

    if (isLiveMode(tradingConfig)) {
      // Check trade size cap
      const tradeSizeViolation = checkTradeSizeCap(sizeUsd, tradingConfig);
      if (tradeSizeViolation) {
        logSafetyCapViolation(botId, 'MAX_TRADE_SIZE', tradeSizeViolation.message);
        console.log(`${COLORS.yellow}   Max trade size exceeded, skipping live trade.${COLORS.reset}`);
        return;
      }

      // Check daily notional cap
      const dailyNotional = await getDailyNotionalForBot(bot.botId);
      const dailyCapViolation = checkDailyNotionalCap(dailyNotional, sizeUsd, tradingConfig);
      if (dailyCapViolation) {
        logSafetyCapViolation(botId, 'MAX_DAILY_NOTIONAL', dailyCapViolation.message);
        console.log(`${COLORS.yellow}   Daily notional cap reached for bot ${botId}, skipping live trade.${COLORS.reset}`);
        return;
      }

      // Validate live trading configuration
      const configError = validateLiveTradingConfig(tradingConfig);
      if (configError) {
        logError(botId, `Live trading config error: ${configError}`);
        return;
      }
    }

    // ========================================================================
    // Step 5: Map signal to trade action
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
    // Step 6: Discover current market
    // ========================================================================
    const { getCurrentMarketId } = await import('@botmarket/shared');
    let marketId = await getCurrentMarketId(config.market.currency, config.market.timeframe);
    
    // If market discovery fails, generate a mock market ID for demo purposes
    if (!marketId) {
      if (mode === 'mock') {
        // Generate deterministic mock market ID for demo
        const dateStr = new Date().toISOString().split('T')[0];
        marketId = `mock_${config.market.currency.toLowerCase()}_${config.market.timeframe}_${dateStr}`;
        console.log(`${COLORS.yellow}⚠️  Market not found, using mock market ID: ${marketId}${COLORS.reset}`);
      } else {
      throw new Error(`Could not find current market for ${config.market.currency} ${config.market.timeframe}`);
    }
    }
    
    // ========================================================================
    // Step 7: Execute order based on trading mode
    // ========================================================================
    if (mode === 'mock') {
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

      logTradeComplete(botId, signal, side, outcome, mode);

    } else {
      // ======================================================================
      // LIVE EXECUTION PATH (gamma or mainnet)
      // ======================================================================
      console.log(`${COLORS.bright}${COLORS.magenta}🔴 LIVE TRADING MODE: ${mode.toUpperCase()}${COLORS.reset}`);
      
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

      // Get private key for signing
      if (!tradingConfig.privateKey) {
        throw new Error('POLYMARKET_PRIVATE_KEY is not configured');
      }

      // Calculate price (for limit orders, we'll use mid-price or a reasonable default)
      // In production, this should fetch from the order book
      const price = 50; // 50 cents = $0.50, represents fair value for binary market

      // Convert size to token amount (sizeUsd / price)
      // Price is in cents (0-100), so we calculate tokens based on USDC
      const tokenSize = Math.floor((sizeUsd / (price / 100)) * 1e6).toString();

      // Build and sign the order
      const orderInput: PolymarketOrderInput = {
        tokenId,
        side: side === 'BUY' ? PolymarketOrderSide.BUY : PolymarketOrderSide.SELL,
        price,
        size: tokenSize,
        feeRateBps: 0,
      };

      console.log(`${COLORS.cyan}📝 Signing order...${COLORS.reset}`);
      console.log(`${COLORS.cyan}   Token ID:${COLORS.reset} ${tokenId}`);
      console.log(`${COLORS.cyan}   Side:${COLORS.reset}     ${side}`);
      console.log(`${COLORS.cyan}   Size:${COLORS.reset}     $${sizeUsd.toFixed(2)} (${tokenSize} tokens)`);
      console.log(`${COLORS.cyan}   Price:${COLORS.reset}    ${price} cents`);

      const signedOrder = await signPolymarketOrder(orderInput, tradingConfig.privateKey);

      // Store order in database first (as PENDING)
    const dbOrder = await prisma.order.create({
      data: {
          botId: bot.botId,
          marketId,
        outcome,
        side,
          price: price / 100, // Store as decimal
        size: sizeUsd,
        status: 'PENDING',
        tokenId,
      },
    });

      // Submit order to Polymarket
      try {
        const response = await submitOrderToPolymarket(signedOrder, mode);

        if (response.orderId && response.status !== 'CANCELED') {
          // Update order with Polymarket order ID
          await prisma.order.update({
            where: { id: dbOrder.id },
            data: {
              orderId: response.orderId,
              status: response.status === 'MATCHED' ? ORDER_STATUS.FILLED : ORDER_STATUS.PENDING,
            },
          });

          logLiveOrderSubmitted(response.orderId, mode);

          // If there are fills, record them
          if (response.fills && response.fills.length > 0) {
            for (const fill of response.fills) {
              await prisma.fill.create({
                data: {
                  botId: bot.botId,
                  orderId: dbOrder.id,
                  price: parseFloat(fill.price),
                  size: parseFloat(fill.size),
                  fees: 0, // TODO: Get actual fees from response
                  fillId: fill.fillId,
                },
              });
            }
          }

          logTradeComplete(botId, signal, side, outcome, mode);
        } else {
          // Order failed or was rejected
          await prisma.order.update({
            where: { id: dbOrder.id },
            data: { status: ORDER_STATUS.CANCELLED },
          });
          
          throw new Error(`Order submission failed: ${response.errorMsg || 'Unknown error'}`);
        }
      } catch (submitError: any) {
        // Update order status to cancelled on error
        await prisma.order.update({
          where: { id: dbOrder.id },
          data: { status: ORDER_STATUS.CANCELLED },
        });
        throw submitError;
      }
    }

    // ========================================================================
    // Step 8: Trigger metrics update
    // ========================================================================
    await metricsQueue.add('update-metrics', {
      botId,
    });

  } catch (error: any) {
    logError(botId, error.message);
    throw error;
  }
}
