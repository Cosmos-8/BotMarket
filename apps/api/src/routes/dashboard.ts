import { Router, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress } from 'ethers';
import { Wallet } from 'ethers';
import { decryptPrivateKey } from '@botmarket/shared';

const router: IRouter = Router();

/**
 * GET /dashboard/:address
 * Get dashboard data for a user including:
 * - Trading pool balance
 * - All bots created by the user
 * - Bot balances and metrics
 * - Summary statistics
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    // Normalize address (checksum)
    const normalizedAddress = getAddress(address);

    // Get user data
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
    });

    if (!user) {
      return res.json({
        success: true,
        data: {
          address: normalizedAddress,
          poolBalance: 0,
          proxyWallet: null,
          bots: [],
          summary: {
            totalBots: 0,
            activeBots: 0,
            totalPnl: 0,
            totalRoi: 0,
            bestPerformingBot: null,
          },
        },
      });
    }

    // Get all bots created by this user
    const bots = await prisma.bot.findMany({
      where: { creator: normalizedAddress },
      include: {
        metrics: true,
        keys: {
          take: 1,
        },
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Derive wallet addresses and get bot balances
    const botsWithBalances = await Promise.all(
      bots.map(async (bot) => {
        let walletAddress: string | null = null;
        let allocatedBalance = 0;

        // Derive wallet address from private key
        if (bot.keys && bot.keys.length > 0) {
          try {
            const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
            const privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
            const wallet = new Wallet(privateKey);
            walletAddress = wallet.address;
          } catch (err) {
            console.error(`Failed to derive wallet for bot ${bot.botId}:`, err);
          }
        }

        // Get allocated balance from metrics (pnlUsd represents the bot's balance)
        if (bot.metrics) {
          allocatedBalance = bot.metrics.pnlUsd || 0;
        }

        return {
          botId: bot.botId,
          creator: bot.creator,
          visibility: bot.visibility,
          isActive: bot.isActive,
          createdAt: bot.createdAt,
          walletAddress,
          allocatedBalance,
          metrics: bot.metrics,
          config: bot.configs[0]?.configJSON || null,
        };
      })
    );

    // Calculate summary statistics
    const activeBots = bots.filter((b) => b.isActive).length;
    const totalPnl = bots.reduce((sum, bot) => sum + (bot.metrics?.pnlUsd || 0), 0);
    const totalRoi = bots.length > 0
      ? bots.reduce((sum, bot) => sum + (bot.metrics?.roiPct || 0), 0) / bots.length
      : 0;

    // Find best performing bot (by ROI)
    const bestPerformingBot = bots.length > 0
      ? bots.reduce((best, bot) => {
          const botRoi = bot.metrics?.roiPct || 0;
          const bestRoi = best.metrics?.roiPct || 0;
          return botRoi > bestRoi ? bot : best;
        })
      : null;

    // Get proxy wallet address
    let proxyWalletAddress: string | null = null;
    if (user.proxyWalletAddress) {
      proxyWalletAddress = user.proxyWalletAddress;
    }

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        poolBalance: user.usdcBalance,
        proxyWallet: proxyWalletAddress
          ? {
              address: proxyWalletAddress,
              network: 'Polygon',
            }
          : null,
        bots: botsWithBalances,
        summary: {
          totalBots: bots.length,
          activeBots,
          totalPnl,
          totalRoi,
          bestPerformingBot: bestPerformingBot
            ? {
                botId: bestPerformingBot.botId,
                roi: bestPerformingBot.metrics?.roiPct || 0,
                pnl: bestPerformingBot.metrics?.pnlUsd || 0,
              }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
    });
  }
});

export default router;

