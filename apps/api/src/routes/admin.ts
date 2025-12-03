import { Router, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { metricsQueue } from '../lib/queue';
import { AuthenticatedRequest } from '../middleware/auth';

const router: IRouter = Router();

// Simple admin check (for MVP - should be more secure in production)
const ADMIN_ADDRESSES = (process.env.ADMIN_ADDRESSES || '').split(',').filter(Boolean);

function isAdmin(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  if (ADMIN_ADDRESSES.length === 0) return true; // Allow all if no admins configured
  return ADMIN_ADDRESSES.includes(req.user.address.toLowerCase());
}

/**
 * POST /admin/simulate-fill
 * Simulate a fill for demo purposes
 */
router.post('/simulate-fill', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // For MVP, allow without auth for demo
    // In production, require admin authentication
    
    const { botId, orderId, price, size, fees } = req.body;

    if (!botId || !orderId || price === undefined || size === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: botId, orderId, price, size',
      });
    }

    // Get bot
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        orders: {
          where: { id: orderId },
        },
      },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    const order = bot.orders[0];
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Create fill
    const fill = await prisma.fill.create({
      data: {
        botId: bot.id,
        orderId: order.id,
        price: parseFloat(price),
        size: parseFloat(size),
        fees: parseFloat(fees || 0),
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'FILLED' },
    });

    // Trigger metrics update
    await metricsQueue.add('update-metrics', {
      botId,
    });

    res.json({
      success: true,
      data: {
        fillId: fill.id,
        orderId: fill.orderId,
        price: fill.price,
        size: fill.size,
        fees: fill.fees,
      },
    });
  } catch (error: any) {
    console.error('Error simulating fill:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to simulate fill',
    });
  }
});

/**
 * POST /admin/reset-bot
 * Reset bot metrics and trades (for demo)
 */
router.post('/reset-bot/:botId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findUnique({
      where: { botId },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    // Delete all orders, fills, and metrics
    await prisma.$transaction([
      prisma.fill.deleteMany({ where: { botId: bot.id } }),
      prisma.order.deleteMany({ where: { botId: bot.id } }),
      prisma.signal.deleteMany({ where: { botId: bot.id } }),
      prisma.botMetrics.deleteMany({ where: { botId: bot.id } }),
    ]);

    res.json({
      success: true,
      message: 'Bot reset successfully',
    });
  } catch (error: any) {
    console.error('Error resetting bot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset bot',
    });
  }
});

export default router;

