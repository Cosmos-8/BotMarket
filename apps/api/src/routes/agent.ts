import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma';

const router = Router();

// Redis connection for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = {
  host: new URL(redisUrl).hostname,
  port: parseInt(new URL(redisUrl).port || '6379'),
};

// Queue to send commands to the agent worker
const agentQueue = new Queue('agent-commands', { connection });

/**
 * GET /agent/:botId/status
 * Get the AI agent status for a bot
 */
router.get('/:botId/status', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findFirst({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    const config = bot.configs[0]?.configJSON as Record<string, any>;
    const aiEnabled = config?.ai?.enabled === true;

    res.json({
      success: true,
      data: {
        botId,
        aiEnabled,
        config: config?.ai || null,
      },
    });
  } catch (error: any) {
    console.error('Error getting agent status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /agent/:botId/start
 * Start the AI agent for a bot
 */
router.post('/:botId/start', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { config } = req.body;

    const bot = await prisma.bot.findFirst({
      where: { botId },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    // Send start command to agent worker
    await agentQueue.add('start-agent', {
      command: 'START',
      botId,
      config: config || {},
    });

    res.json({
      success: true,
      message: 'AI agent start command sent',
    });
  } catch (error: any) {
    console.error('Error starting agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /agent/:botId/stop
 * Stop the AI agent for a bot
 */
router.post('/:botId/stop', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findFirst({
      where: { botId },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    // Send stop command to agent worker
    await agentQueue.add('stop-agent', {
      command: 'STOP',
      botId,
    });

    res.json({
      success: true,
      message: 'AI agent stop command sent',
    });
  } catch (error: any) {
    console.error('Error stopping agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /agent/:botId/configure
 * Update AI agent configuration
 */
router.post('/:botId/configure', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { aiConfig } = req.body;

    const bot = await prisma.bot.findFirst({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    // Merge AI config with existing config
    const existingConfig = (bot.configs[0]?.configJSON as Record<string, any>) || {};
    const newConfig = {
      ...existingConfig,
      ai: {
        enabled: true,
        ...existingConfig.ai,
        ...aiConfig,
      },
    };

    // Update the config in database
    if (bot.configs[0]) {
      await prisma.botConfig.update({
        where: { id: bot.configs[0].id },
        data: { configJSON: newConfig },
      });
    } else {
      await prisma.botConfig.create({
        data: {
          botId,
          configJSON: newConfig,
          version: 1,
        },
      });
    }

    // Send update command to running agent (if any)
    await agentQueue.add('update-config', {
      command: 'UPDATE_CONFIG',
      botId,
      config: newConfig,
    });

    res.json({
      success: true,
      message: 'AI agent configuration updated',
      config: newConfig.ai,
    });
  } catch (error: any) {
    console.error('Error configuring agent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /agent/:botId/intelligence
 * Get recent intelligence gathered by the agent
 */
router.get('/:botId/intelligence', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const bot = await prisma.bot.findFirst({
      where: { botId },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    // Get recent AI-generated signals
    const signals = await prisma.signal.findMany({
      where: {
        botId,
        source: 'AI_AGENT',
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: signals.map(s => ({
        id: s.id,
        signal: s.signal,
        timestamp: s.receivedAt,
        metadata: s.metadata,
      })),
    });
  } catch (error: any) {
    console.error('Error getting intelligence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
