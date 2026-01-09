import { prisma } from '../lib/prisma';

interface Position {
  marketId: string;
  outcome: string;
  totalCost: number;
  totalShares: number;
  averagePrice: number;
}

/**
 * Calculate bot metrics (PNL, ROI, win rate, etc.)
 */
export async function updateBotMetrics(botId: string): Promise<void> {
  try {
    // Get bot
    const bot = await prisma.bot.findUnique({
      where: { botId },
    });

    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    // Get all fills for this bot
    // Note: Fill.botId references Bot.botId (external ID), not Bot.id (internal cuid)
    const fills = await prisma.fill.findMany({
      where: { botId: bot.botId },
      include: {
        order: true,
      },
      orderBy: { fillAt: 'asc' },
    });

    // Get all orders to track positions
    const orders = await prisma.order.findMany({
      where: { botId: bot.botId },
      include: {
        fills: true,
      },
    });

    // Calculate positions
    const positions = new Map<string, Position>();

    for (const fill of fills) {
      const order = fill.order;
      const key = `${order.marketId}-${order.outcome}`;

      if (!positions.has(key)) {
        positions.set(key, {
          marketId: order.marketId,
          outcome: order.outcome,
          totalCost: 0,
          totalShares: 0,
          averagePrice: 0,
        });
      }

      const position = positions.get(key)!;
      
      if (order.side === 'BUY') {
        position.totalCost += fill.price * fill.size + fill.fees;
        position.totalShares += fill.size;
      } else {
        // SELL - reduce position
        position.totalCost -= fill.price * fill.size - fill.fees;
        position.totalShares -= fill.size;
      }

      if (position.totalShares > 0) {
        position.averagePrice = position.totalCost / position.totalShares;
      } else {
        position.averagePrice = 0;
      }
    }

    // Calculate realized PNL (from closed positions)
    // For MVP, we'll use a simplified approach
    // In production, we'd track market resolution and calculate actual PNL
    
    let realizedPnl = 0;
    let totalTrades = fills.length;
    let winningTrades = 0;
    let losingTrades = 0;

    // Calculate unrealized PNL for open positions
    // For MVP, we'll estimate based on current market prices
    // TODO: Fetch current market prices from Polymarket API
    let unrealizedPnl = 0;

    for (const [key, position] of positions.entries()) {
      if (position.totalShares > 0) {
        // Open position - calculate unrealized PNL
        // Assuming current price is 0.5 (50%) for MVP
        // In production, fetch actual market price
        const currentPrice = 0.5;
        const positionValue = position.totalShares * currentPrice;
        unrealizedPnl += positionValue - position.totalCost;
      } else if (position.totalCost < 0) {
        // Closed position with profit
        realizedPnl += Math.abs(position.totalCost);
        winningTrades++;
      } else if (position.totalCost > 0) {
        // Closed position with loss
        realizedPnl -= position.totalCost;
        losingTrades++;
      }
    }

    const totalPnl = realizedPnl + unrealizedPnl;

    // Calculate total capital deployed
    const totalCapital = fills.reduce((sum, fill) => {
      return sum + (fill.price * fill.size + fill.fees);
    }, 0);

    // Calculate ROI
    const roiPct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;

    // Calculate win rate
    const totalClosedTrades = winningTrades + losingTrades;
    const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;

    // Calculate max drawdown
    // Simplified: track peak and current value
    // TODO: Implement proper drawdown calculation
    let maxDrawdown = 0;
    let peak = 0;
    let currentValue = 0;

    for (const fill of fills) {
      if (fill.order.side === 'BUY') {
        currentValue -= fill.price * fill.size + fill.fees;
      } else {
        currentValue += fill.price * fill.size - fill.fees;
      }

      if (currentValue > peak) {
        peak = currentValue;
      }

      const drawdown = currentValue - peak;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Update or create metrics
    // Note: BotMetrics.botId references Bot.botId (external ID), not Bot.id (internal cuid)
    await prisma.botMetrics.upsert({
      where: { botId: bot.botId },
      create: {
        botId: bot.botId,
        pnlUsd: totalPnl,
        roiPct,
        trades: totalTrades,
        winRate,
        maxDrawdown,
      },
      update: {
        pnlUsd: totalPnl,
        roiPct,
        trades: totalTrades,
        winRate,
        maxDrawdown,
      },
    });

    console.log(`Metrics updated for bot ${botId}: PNL=$${totalPnl.toFixed(2)}, ROI=${roiPct.toFixed(2)}%, WinRate=${winRate.toFixed(2)}%`);
  } catch (error: any) {
    console.error(`Error updating metrics for bot ${botId}:`, error);
    throw error;
  }
}

