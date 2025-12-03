import { Router, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

const router: IRouter = Router();

/**
 * GET /marketplace
 * Get leaderboard of bots
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sort = req.query.sort as string || 'roi';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    // Only show public bots
    const where = {
      visibility: 'PUBLIC',
    };

    let orderBy: any = { createdAt: 'desc' };
    
    // For now, we'll sort by metrics when available
    // TODO: Implement proper sorting by ROI/PNL when metrics are populated
    if (sort === 'roi' || sort === 'pnl') {
      // Join with metrics
      orderBy = { createdAt: 'desc' };
    }

    const [bots, total] = await Promise.all([
      prisma.bot.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          metrics: true,
          _count: {
            select: { forkedBots: true },
          },
        },
      }),
      prisma.bot.count({ where }),
    ]);

    // Sort by metrics if available
    let sortedBots = bots;
    if (sort === 'roi' && bots.some(b => b.metrics)) {
      sortedBots = [...bots].sort((a, b) => {
        const aRoi = a.metrics?.roiPct || 0;
        const bRoi = b.metrics?.roiPct || 0;
        return bRoi - aRoi;
      });
    } else if (sort === 'pnl' && bots.some(b => b.metrics)) {
      sortedBots = [...bots].sort((a, b) => {
        const aPnl = a.metrics?.pnlUsd || 0;
        const bPnl = b.metrics?.pnlUsd || 0;
        return bPnl - aPnl;
      });
    } else if (sort === 'winrate' && bots.some(b => b.metrics)) {
      sortedBots = [...bots].sort((a, b) => {
        const aWinrate = a.metrics?.winRate || 0;
        const bWinrate = b.metrics?.winRate || 0;
        return bWinrate - aWinrate;
      });
    }

    res.json({
      success: true,
      data: sortedBots.map(bot => ({
        botId: bot.botId,
        creator: bot.creator,
        visibility: bot.visibility,
        metrics: bot.metrics ? {
          pnlUsd: bot.metrics.pnlUsd,
          roiPct: bot.metrics.roiPct,
          trades: bot.metrics.trades,
          winRate: bot.metrics.winRate,
          maxDrawdown: bot.metrics.maxDrawdown,
        } : null,
        forkCount: bot._count.forkedBots,
        createdAt: bot.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error getting marketplace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get marketplace',
    });
  }
});

/**
 * GET /marketplace/:botId
 * Get detailed bot stats for marketplace
 */
router.get('/:botId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        metrics: true,
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 50,
        },
        fills: {
          orderBy: { fillAt: 'desc' },
          take: 50,
        },
        _count: {
          select: { forkedBots: true },
        },
      },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    // Only show public bots or bots owned by requester
    if (bot.visibility !== 'PUBLIC' && bot.creator !== req.user?.address) {
      return res.status(403).json({
        success: false,
        error: 'Bot is private',
      });
    }

    res.json({
      success: true,
      data: {
        botId: bot.botId,
        creator: bot.creator,
        parentBotId: bot.parentBotId,
        visibility: bot.visibility,
        config: bot.configs[0]?.configJSON,
        metrics: bot.metrics,
        recentOrders: bot.orders,
        recentFills: bot.fills,
        forkCount: bot._count.forkedBots,
        createdAt: bot.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error getting marketplace bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot details',
    });
  }
});

export default router;

