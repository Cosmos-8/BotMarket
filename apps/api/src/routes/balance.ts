import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress, Wallet, JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';
import { encryptPrivateKey, decryptPrivateKey } from '@botmarket/shared';

const router: IRouter = Router();

// ============================================================================
// Constants
// ============================================================================

const MAX_FUND_AMOUNT = 1_000_000; // Max $1M per transaction
const MIN_FUND_AMOUNT = 0.01;      // Min $0.01
const MIN_WITHDRAW_AMOUNT = 0.01;  // Min $0.01 for withdrawal

// USDC Contract on Polygon Mainnet
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_DECIMALS = 6;

// USDC ABI (minimal - just transfer function)
const USDC_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

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

function logWithdraw(from: string, to: string, amount: number, txHash: string): void {
  const shortFrom = `${from.slice(0, 6)}...${from.slice(-4)}`;
  const shortTo = `${to.slice(0, 6)}...${to.slice(-4)}`;
  console.log(`💸 WITHDRAW: $${amount.toFixed(2)} USDC from ${shortFrom} → ${shortTo} | TX: ${txHash}`);
}

/**
 * Create a proxy wallet for a user if they don't have one.
 * This is their "main pool" wallet on Polygon for Polymarket trading.
 */
async function ensureProxyWallet(userId: string, polygonAddress: string): Promise<{ address: string; isNew: boolean }> {
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

  const shortAddr = `${polygonAddress.slice(0, 6)}...${polygonAddress.slice(-4)}`;
  console.log(`🔐 Created proxy wallet for ${shortAddr}: ${proxyAddress}`);

  return { address: proxyAddress, isNew: true };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /balance/:address
 * Get USDC balance for a wallet address on Polygon.
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

    // Find or create user (using Polygon address)
    const user = await prisma.user.upsert({
      where: { polygonAddress: normalizedAddress },
      create: {
        polygonAddress: normalizedAddress,
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
          note: 'This is your main trading wallet on Polygon. Deposit USDC here.',
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
 * Record a USDC deposit to wallet balance.
 * In production, this would verify the on-chain transfer first.
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

    // Upsert user and add to balance (using Polygon address)
    const user = await prisma.user.upsert({
      where: { polygonAddress: normalizedAddress },
      create: {
        polygonAddress: normalizedAddress,
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

    // Get user and check balance (using Polygon address)
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
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
        where: { polygonAddress: normalizedAddress },
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
      where: { polygonAddress: normalizedAddress },
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

/**
 * POST /balance/withdraw
 * Withdraw USDC from main platform balance (proxy wallet -> user wallet)
 * 
 * Body: { address: string, amount: number, toAddress: string }
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { address, amount, toAddress } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid from address' });
    }

    if (!toAddress || !isAddress(toAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid to address' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < MIN_WITHDRAW_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_WITHDRAW_AMOUNT} USDC`,
      });
    }

    const normalizedAddress = getAddress(address);
    const normalizedToAddress = getAddress(toAddress);

    // Get user and check balance
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.proxyWalletAddress || !user.encryptedProxyKey) {
      return res.status(400).json({
        success: false,
        error: 'No proxy wallet found. Please deposit funds first.',
      });
    }

    if (user.usdcBalance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You have $${user.usdcBalance.toFixed(2)} but tried to withdraw $${amount.toFixed(2)}`,
      });
    }

    // Decrypt proxy wallet private key
    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(user.encryptedProxyKey, encryptionSecret);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to decrypt wallet key',
      });
    }

    // Get RPC provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new JsonRpcProvider(rpcUrl);

    // Create wallet and USDC contract
    const wallet = new Wallet(privateKey, provider);
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, wallet);

    // Check on-chain balance
    const onChainBalance = await usdcContract.balanceOf(wallet.address);
    const onChainBalanceFormatted = parseFloat(formatUnits(onChainBalance, USDC_DECIMALS));

    if (onChainBalanceFormatted < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient on-chain balance. Wallet has $${onChainBalanceFormatted.toFixed(2)} USDC`,
      });
    }

    // Transfer USDC
    const amountWei = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const tx = await usdcContract.transfer(normalizedToAddress, amountWei);
    const receipt = await tx.wait();

    // Update database balance
    const updatedUser = await prisma.user.update({
      where: { polygonAddress: normalizedAddress },
      data: {
        usdcBalance: {
          decrement: amount,
        },
      },
    });

    logWithdraw(wallet.address, normalizedToAddress, amount, receipt.hash);

    res.json({
      success: true,
      data: {
        txHash: receipt.hash,
        amount,
        from: wallet.address,
        to: normalizedToAddress,
        newBalance: updatedUser.usdcBalance,
      },
      message: `Successfully withdrew ${amount} USDC`,
    });
  } catch (error: any) {
    console.error('Error withdrawing balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to withdraw balance',
    });
  }
});

/**
 * POST /balance/bot/:botId/withdraw
 * Withdraw USDC from bot balance
 * 
 * Options:
 * 1. Withdraw to main trading pool (internal transfer - no on-chain)
 * 2. Withdraw to user wallet (on-chain transfer)
 * 
 * Body: { address: string, amount: number, toAddress?: string, toPool?: boolean }
 * - If toPool is true: internal transfer to user's main pool (no on-chain)
 * - If toPool is false or undefined: on-chain transfer to toAddress (or address if not provided)
 */
router.post('/bot/:botId/withdraw', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { address, amount, toAddress, toPool } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < MIN_WITHDRAW_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_WITHDRAW_AMOUNT} USDC`,
      });
    }

    const normalizedAddress = getAddress(address);
    
    // Determine destination
    const withdrawToPool = toPool === true;
    const destinationAddress = withdrawToPool ? normalizedAddress : (toAddress ? getAddress(toAddress) : normalizedAddress);
    
    // Validate toAddress only if not withdrawing to pool
    if (!withdrawToPool) {
      if (!destinationAddress || !isAddress(destinationAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid to address' });
      }
    }

    // Get bot and verify ownership
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        metrics: true,
        keys: {
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    if (bot.creator.toLowerCase() !== normalizedAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'You can only withdraw from your own bots',
      });
    }

    const botBalance = bot.metrics?.pnlUsd || 0;
    if (botBalance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient bot balance. Bot has $${botBalance.toFixed(2)} but tried to withdraw $${amount.toFixed(2)}`,
      });
    }

    if (withdrawToPool) {
      // Internal transfer to main pool (no on-chain transaction needed)
      const user = await prisma.user.findUnique({
        where: { polygonAddress: normalizedAddress },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Update balances in a transaction
      const [updatedMetrics, updatedUser] = await prisma.$transaction([
        // Deduct from bot
        prisma.botMetrics.update({
          where: { botId },
          data: {
            pnlUsd: {
              decrement: amount,
            },
          },
        }),
        // Add to user's main pool
        prisma.user.update({
          where: { polygonAddress: normalizedAddress },
          data: {
            usdcBalance: {
              increment: amount,
            },
          },
        }),
      ]);

      console.log(`💸 WITHDRAW TO POOL: $${amount} from bot ${botId} → user pool`);

      res.json({
        success: true,
        data: {
          amount,
          toPool: true,
          newBotBalance: updatedMetrics.pnlUsd,
          newPoolBalance: updatedUser.usdcBalance,
        },
        message: `Successfully transferred ${amount} USDC from bot to your trading pool`,
      });
    } else {
      // On-chain transfer to wallet
      if (!bot.keys || bot.keys.length === 0 || !bot.keys[0].encryptedPrivKey) {
        return res.status(400).json({
          success: false,
          error: 'Bot wallet not found',
        });
      }

      // Decrypt bot wallet private key
      const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
      let privateKey: string;
      try {
        privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: 'Failed to decrypt bot wallet key',
        });
      }

      // Get RPC provider
      const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
      const provider = new JsonRpcProvider(rpcUrl);

      // Create wallet and USDC contract
      const wallet = new Wallet(privateKey, provider);
      const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, wallet);

      // Check on-chain balance
      const onChainBalance = await usdcContract.balanceOf(wallet.address);
      const onChainBalanceFormatted = parseFloat(formatUnits(onChainBalance, USDC_DECIMALS));

      if (onChainBalanceFormatted < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient on-chain balance. Bot wallet has $${onChainBalanceFormatted.toFixed(2)} USDC`,
        });
      }

      // Transfer USDC
      const amountWei = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
      const tx = await usdcContract.transfer(destinationAddress, amountWei);
      const receipt = await tx.wait();

      // Update database balance
      const updatedMetrics = await prisma.botMetrics.update({
        where: { botId },
        data: {
          pnlUsd: {
            decrement: amount,
          },
        },
      });

      logWithdraw(wallet.address, destinationAddress, amount, receipt.hash);

      res.json({
        success: true,
        data: {
          txHash: receipt.hash,
          amount,
          from: wallet.address,
          to: destinationAddress,
          toPool: false,
          newBotBalance: updatedMetrics.pnlUsd,
        },
        message: `Successfully withdrew ${amount} USDC from bot to your wallet`,
      });
    }
  } catch (error: any) {
    console.error('Error withdrawing from bot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to withdraw from bot',
    });
  }
});

export default router;
