import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress, Wallet } from 'ethers';
import { encryptPrivateKey } from '@botmarket/shared';

const router: IRouter = Router();

// ============================================================================
// Constants
// ============================================================================

const MAX_FUND_AMOUNT = 1_000_000; // Max $1M per transaction
const MIN_FUND_AMOUNT = 0.01;      // Min $0.01

// ============================================================================
// Logging Helpers
// ============================================================================

function logFund(address: string, amount: number, newBalance: number): void {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`💵 FUND BALANCE: +${amount} USDC for ${shortAddr} → New balance: ${newBalance.toFixed(2)} USDC`);
}

function logBalance(address: string, balance: number): void {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`💰 GET BALANCE: ${shortAddr} → ${balance.toFixed(2)} USDC`);
}

/**
 * Create a proxy wallet for a user if they don't have one.
 * This is their "main pool" wallet on Polygon for Polymarket trading.
 */
async function ensureProxyWallet(userId: string, baseAddress: string): Promise<{ address: string; isNew: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { proxyWalletAddress: true, encryptedProxyKey: true },
  });

  // Return existing wallet if present
  if (user?.proxyWalletAddress) {
    return { address: user.proxyWalletAddress, isNew: false };
  }

  // Generate new proxy wallet
  const proxyWallet = Wallet.createRandom();
  const proxyAddress = proxyWallet.address;
  const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
  const encryptedKey = encryptPrivateKey(proxyWallet.privateKey, encryptionSecret);

  // Update user with proxy wallet
  await prisma.user.update({
    where: { id: userId },
    data: {
      proxyWalletAddress: proxyAddress,
      encryptedProxyKey: encryptedKey,
    },
  });

  const shortAddr = `${baseAddress.slice(0, 6)}...${baseAddress.slice(-4)}`;
  console.log(`🔐 Created proxy wallet for ${shortAddr}: ${proxyAddress}`);

  return { address: proxyAddress, isNew: true };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /balance/:address
 * Get USDC balance for a wallet address.
 * Creates user with 0 balance if not exists.
 * Also initializes proxy wallet for Polymarket trading.
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

    // Find or create user
    const user = await prisma.user.upsert({
      where: { baseAddress: normalizedAddress },
      create: {
        baseAddress: normalizedAddress,
        usdcBalance: 0,
      },
      update: {}, // No update needed, just ensure exists
    });

    // Ensure user has a proxy wallet for Polymarket trading
    const proxyWallet = await ensureProxyWallet(user.id, normalizedAddress);

    logBalance(normalizedAddress, user.usdcBalance);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: user.usdcBalance,
        // User's main proxy wallet for Polymarket
        proxyWallet: {
          address: proxyWallet.address,
          network: 'Polygon',
          isNew: proxyWallet.isNew,
          note: 'This is your main trading wallet on Polygon. Fund it with USDC and MATIC.',
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
    });
  }
});

/**
 * POST /balance/fund
 * Add USDC to wallet balance (mock funding).
 * 
 * Body: { address: string, amount: number }
 */
router.post('/fund', async (req: Request, res: Response) => {
  try {
    const { address, amount } = req.body;

    // Validate address
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a number',
      });
    }

    if (amount < MIN_FUND_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_FUND_AMOUNT} USDC`,
      });
    }

    if (amount > MAX_FUND_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount cannot exceed ${MAX_FUND_AMOUNT.toLocaleString()} USDC`,
      });
    }

    // Normalize address
    const normalizedAddress = getAddress(address);

    // Upsert user and add to balance
    const user = await prisma.user.upsert({
      where: { baseAddress: normalizedAddress },
      create: {
        baseAddress: normalizedAddress,
        usdcBalance: amount,
      },
      update: {
        usdcBalance: {
          increment: amount,
        },
      },
    });

    logFund(normalizedAddress, amount, user.usdcBalance);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: user.usdcBalance,
        funded: amount,
      },
      message: `Successfully funded ${amount} USDC`,
    });
  } catch (error: any) {
    console.error('Error funding balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fund balance',
    });
  }
});

/**
 * POST /balance/allocate-to-bot
 * Allocate funds from user's main pool to a specific bot.
 * This is an internal transfer, not from external wallet.
 * 
 * Body: { address: string, botId: string, amount: number }
 */
router.post('/allocate-to-bot', async (req: Request, res: Response) => {
  try {
    const { address, botId, amount } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (!botId) {
      return res.status(400).json({ success: false, error: 'Bot ID required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const normalizedAddress = getAddress(address);

    // Get user and check balance
    const user = await prisma.user.findUnique({
      where: { baseAddress: normalizedAddress },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.usdcBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient balance. You have $${user.usdcBalance.toFixed(2)} but tried to allocate $${amount.toFixed(2)}` 
      });
    }

    // Get bot and verify ownership
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: { metrics: true },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    if (bot.creator.toLowerCase() !== normalizedAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You can only fund your own bots' });
    }

    // Perform the allocation (deduct from user, add to bot metrics)
    await prisma.$transaction([
      // Deduct from user's pool
      prisma.user.update({
        where: { baseAddress: normalizedAddress },
        data: { usdcBalance: { decrement: amount } },
      }),
      // Update or create bot metrics with allocated balance
      prisma.botMetrics.upsert({
        where: { botId },
        create: {
          botId,
          pnlUsd: amount, // Using pnlUsd to track allocated balance for now
          roiPct: 0,
          trades: 0,
          winRate: 0,
          maxDrawdown: 0,
        },
        update: {
          pnlUsd: { increment: amount },
        },
      }),
    ]);

    // Get updated balances
    const updatedUser = await prisma.user.findUnique({
      where: { baseAddress: normalizedAddress },
    });

    console.log(`💸 ALLOCATE: $${amount} from ${normalizedAddress.slice(0,6)}... to bot ${botId}`);

    res.json({
      success: true,
      data: {
        allocated: amount,
        userBalance: updatedUser?.usdcBalance || 0,
        botId,
      },
      message: `Allocated $${amount.toFixed(2)} to bot`,
    });
  } catch (error: any) {
    console.error('Error allocating to bot:', error);
    res.status(500).json({ success: false, error: 'Failed to allocate funds' });
  }
});

/**
 * GET /balance/bot/:botId
 * Get allocated balance for a specific bot.
 */
router.get('/bot/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: { metrics: true },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    res.json({
      success: true,
      data: {
        botId,
        allocatedBalance: bot.metrics?.pnlUsd || 0, // pnlUsd stores allocated balance
      },
    });
  } catch (error: any) {
    console.error('Error getting bot balance:', error);
    res.status(500).json({ success: false, error: 'Failed to get bot balance' });
  }
});

export default router;

