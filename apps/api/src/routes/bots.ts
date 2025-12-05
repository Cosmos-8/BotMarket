import { Router, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { tradeSignalQueue } from '../lib/queue';
import { AuthenticatedRequest, verifyWallet } from '../middleware/auth';
import {
  BotConfigSchema,
  CreateBotRequestSchema,
  ForkBotRequestSchema,
  calculateConfigHash,
  encryptPrivateKey,
} from '@botmarket/shared';
import { getAddress, Wallet } from 'ethers';

const router: IRouter = Router();

/**
 * POST /bots
 * Create a new bot
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = CreateBotRequestSchema.parse(req.body);
    
    // For MVP: Use provided creator or default to a placeholder
    // In production, require authentication
    let creator: string;
    if (req.user?.address) {
      creator = req.user.address;
    } else if (req.body.creator) {
      creator = req.body.creator;
    } else {
      // For MVP demo, use a placeholder address
      creator = '0x0000000000000000000000000000000000000000';
    }

    // Validate config
    let config;
    try {
      config = BotConfigSchema.parse(body.config);
    } catch (error: any) {
      console.error('Config validation error:', error);
      return res.status(400).json({
        success: false,
        error: `Invalid bot configuration: ${error.message}`,
        details: error.errors,
      });
    }
    
    const configHash = calculateConfigHash(config);
    
    // Pre-cache upcoming markets for this bot (non-blocking)
    // Run in background - don't block bot creation
    setImmediate(async () => {
      try {
        const { cacheUpcomingMarkets } = await import('@botmarket/shared');
        await cacheUpcomingMarkets(config.market.currency, config.market.timeframe, 24);
        console.log(`Pre-cached markets for ${config.market.currency} ${config.market.timeframe}`);
      } catch (error) {
        console.warn('Failed to pre-cache markets (non-blocking):', error);
        // Continue anyway - markets will be discovered on-demand
      }
    });

    // Generate bot ID (will be replaced with on-chain botId later)
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create or get user
    const user = await prisma.user.upsert({
      where: { baseAddress: creator },
      create: { baseAddress: creator },
      update: {},
    });

    // Generate a proxy wallet for this bot (Polygon-compatible)
    const proxyWallet = Wallet.createRandom();
    const proxyAddress = proxyWallet.address;
    const proxyPrivateKey = proxyWallet.privateKey;

    // Encrypt the private key for storage
    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
    const encryptedKey = encryptPrivateKey(proxyPrivateKey, encryptionSecret);

    // Create bot with proxy wallet
    const bot = await prisma.bot.create({
      data: {
        botId,
        creator: creator,
        visibility: body.visibility,
        metadataURI: body.metadataURI || null,
        configHash,
        configs: {
          create: {
            configJSON: config as any,
            version: config.version,
          },
        },
        // Store the encrypted proxy wallet key
        keys: {
          create: {
            encryptedPrivKey: encryptedKey,
            keyVersion: '1.0',
          },
        },
      },
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

    console.log(`🔐 Generated proxy wallet for bot ${botId}: ${proxyAddress}`);

    res.json({
      success: true,
      data: {
        botId: bot.botId,
        creator: bot.creator,
        visibility: bot.visibility,
        configHash: bot.configHash,
        createdAt: bot.createdAt,
        // Return proxy wallet address so user can fund it
        proxyWallet: {
          address: proxyAddress,
          network: 'Polygon',
          note: 'Fund this wallet with USDC and MATIC to enable live trading',
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating bot:', error);
    
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    // Handle Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Bot with this ID already exists',
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create bot',
    });
  }
});

/**
 * GET /bots
 * List bots with sorting and filtering
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sort = req.query.sort as string || 'created';
    const creator = req.query.creator as string;
    const visibility = req.query.visibility as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (creator) {
      where.creator = getAddress(creator);
    }
    if (visibility) {
      where.visibility = visibility.toUpperCase();
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'roi' || sort === 'pnl') {
      // Join with metrics for sorting
      // For now, sort by createdAt
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

    res.json({
      success: true,
      data: bots.map(bot => ({
        botId: bot.botId,
        creator: bot.creator,
        parentBotId: bot.parentBotId,
        visibility: bot.visibility,
        metrics: bot.metrics,
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
    console.error('Error listing bots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list bots',
    });
  }
});

/**
 * GET /bots/:id
 * Get bot details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bot = await prisma.bot.findUnique({
      where: { botId: id },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        keys: {
          take: 1,
        },
        metrics: true,
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 10,
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

    // Derive proxy wallet address if bot has a key
    let proxyWalletAddress: string | null = null;
    if (bot.keys && bot.keys.length > 0) {
      try {
        const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
        const { decryptPrivateKey } = await import('@botmarket/shared');
        const privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
        const wallet = new Wallet(privateKey);
        proxyWalletAddress = wallet.address;
      } catch (err) {
        console.error('Failed to derive proxy wallet address:', err);
      }
    }

    res.json({
      success: true,
      data: {
        botId: bot.botId,
        creator: bot.creator,
        parentBotId: bot.parentBotId,
        visibility: bot.visibility,
        metadataURI: bot.metadataURI,
        configHash: bot.configHash,
        config: bot.configs[0]?.configJSON,
        metrics: bot.metrics,
        recentOrders: bot.orders,
        forkCount: bot._count.forkedBots,
        createdAt: bot.createdAt,
        // Proxy wallet for live trading
        proxyWallet: proxyWalletAddress ? {
          address: proxyWalletAddress,
          network: 'Polygon',
          note: 'Fund this wallet with USDC and MATIC to enable live trading',
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error getting bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot',
    });
  }
});

/**
 * POST /bots/:id/fork
 * Fork a bot
 */
router.post('/:id/fork', verifyWallet, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const forker = req.user!.address;
    const body = ForkBotRequestSchema.parse(req.body);

    // Get parent bot
    const parentBot = await prisma.bot.findUnique({
      where: { botId: id },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!parentBot) {
      return res.status(404).json({
        success: false,
        error: 'Parent bot not found',
      });
    }

    // Use provided config or clone parent config
    const config = body.config || (parentBot.configs[0]?.configJSON as any);
    const validatedConfig = BotConfigSchema.parse(config);
    const configHash = calculateConfigHash(validatedConfig);

    // Generate new bot ID
    const newBotId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create or get user
    const user = await prisma.user.upsert({
      where: { baseAddress: forker },
      create: { baseAddress: forker },
      update: {},
    });

    // Create forked bot
    const forkedBot = await prisma.bot.create({
      data: {
        botId: newBotId,
        creator: forker,
        parentBotId: id,
        visibility: parentBot.visibility, // Inherit visibility
        metadataURI: body.metadataURI || null,
        configHash,
        configs: {
          create: {
            configJSON: validatedConfig as any,
            version: validatedConfig.version,
          },
        },
      },
    });

    // TODO: Emit BotForked event on Base contract

    res.json({
      success: true,
      data: {
        botId: forkedBot.botId,
        parentBotId: id,
        creator: forkedBot.creator,
        configHash: forkedBot.configHash,
        createdAt: forkedBot.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error forking bot:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to fork bot',
    });
  }
});

/**
 * DELETE /bots/:id
 * Delete a bot and all its related data
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if bot exists
    const bot = await prisma.bot.findUnique({
      where: { botId: id },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    // Delete all related data in order (due to foreign key constraints)
    // 1. Delete fills
    await prisma.fill.deleteMany({
      where: { botId: id },
    });

    // 2. Delete orders
    await prisma.order.deleteMany({
      where: { botId: id },
    });

    // 3. Delete signals
    await prisma.signal.deleteMany({
      where: { botId: id },
    });

    // 4. Delete metrics
    await prisma.botMetrics.deleteMany({
      where: { botId: id },
    });

    // 5. Delete configs
    await prisma.botConfig.deleteMany({
      where: { botId: bot.id },
    });

    // 6. Delete bot keys
    await prisma.botKey.deleteMany({
      where: { botId: bot.id },
    });

    // 7. Finally delete the bot
    await prisma.bot.delete({
      where: { botId: id },
    });

    res.json({
      success: true,
      message: 'Bot deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting bot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete bot',
    });
  }
});

/**
 * GET /bots/:id/signals
 * Get signals for a bot
 */
router.get('/:id/signals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // Check if bot exists
    const bot = await prisma.bot.findUnique({
      where: { botId: id },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    // Fetch signals
    const signals = await prisma.signal.findMany({
      where: { botId: id },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: signals.map(signal => ({
        id: signal.id,
        signalType: signal.signalType,
        receivedAt: signal.receivedAt,
        parsedSignal: signal.parsedSignalJSON,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching signals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signals',
    });
  }
});

/**
 * POST /bots/:id/test-signal
 * Send a test signal (for demo purposes)
 */
router.post('/:id/test-signal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signal } = req.body;

    if (!signal || !['LONG', 'SHORT', 'CLOSE'].includes(signal)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signal. Must be LONG, SHORT, or CLOSE',
      });
    }

    // Enqueue test signal
    await tradeSignalQueue.add('test-signal', {
      botId: id,
      signal,
      timestamp: new Date().toISOString(),
      test: true,
    });

    res.json({
      success: true,
      message: 'Test signal enqueued',
    });
  } catch (error: any) {
    console.error('Error sending test signal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test signal',
    });
  }
});

export default router;

