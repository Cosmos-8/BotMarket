import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { tradeSignalQueue } from '../lib/queue';
import { parseWebhookSignal, hashPayload, verifyWebhookSecret } from '@botmarket/shared';

const router: IRouter = Router();

/**
 * POST /webhook/:botId
 * Receive TradingView webhook signals
 */
router.post('/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const payload = req.body;

    // Get bot and config
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    const config = bot.configs[0]?.configJSON as any;
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Bot configuration not found',
      });
    }

    // Verify webhook secret
    const webhookSecret = req.headers['x-webhook-secret'] as string ||
                         req.headers['authorization']?.replace('Bearer ', '') ||
                         req.headers['x-authorization'] as string;

    if (webhookSecret) {
      const expectedSecret = config.webhook?.secret;
      if (!expectedSecret || !verifyWebhookSecret(webhookSecret, expectedSecret)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook secret',
        });
      }
    } else {
      // Log warning but allow for testing
      console.warn(`No webhook secret provided for bot ${botId}`);
    }

    // Parse signal
    const parsedSignal = parseWebhookSignal(payload);
    if (!parsedSignal) {
      return res.status(400).json({
        success: false,
        error: 'No valid signal found. Expected: signal="LONG"|"SHORT"|"CLOSE", or message containing "long"/"short"',
      });
    }

    // Store signal
    const payloadHash = hashPayload(payload);
    await prisma.signal.create({
      data: {
        botId: bot.botId, // Use external botId, not internal id
        payloadHash,
        parsedSignalJSON: parsedSignal as any,
        signalType: parsedSignal.signalType,
      },
    });

    // Enqueue trade signal job
    await tradeSignalQueue.add('trade-signal', {
      botId,
      signal: parsedSignal.signalType,
      parsedSignal,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Signal received and processed',
      signal: parsedSignal.signalType,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process webhook',
    });
  }
});

export default router;

