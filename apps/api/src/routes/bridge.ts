/**
 * Bridge API Routes
 * 
 * Handles CCTP bridge operations between Base and Polygon.
 * 
 * Endpoints:
 * - POST /bridge/deposit - Initiate deposit (Base -> Polygon)
 * - POST /bridge/withdraw - Initiate withdrawal (Polygon -> Base)
 * - GET /bridge/status/:id - Get bridge transaction status
 * - GET /bridge/history/:address - Get user's bridge history
 * - GET /bridge/balance/:address - Get real USDC balances on both chains
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress } from 'ethers';
import cctp, { CCTP_CONFIG, getUsdcBalance, getProvider, getWallet } from '../lib/cctp';
import { decryptPrivateKey } from '@botmarket/shared';

const router = Router();

// Platform wallet for holding deposits (set via env)
const PLATFORM_BASE_PRIVATE_KEY = process.env.PLATFORM_BASE_PRIVATE_KEY;
const PLATFORM_POLYGON_PRIVATE_KEY = process.env.PLATFORM_POLYGON_PRIVATE_KEY;

// ============================================================================
// Helper Functions
// ============================================================================

function formatUsdcAmount(amount: bigint): number {
  return Number(amount) / 1e6;
}

function parseUsdcAmount(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e6));
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /bridge/balance/:address
 * Get real USDC balances on Base and Polygon
 */
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const normalizedAddress = getAddress(address);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { baseAddress: normalizedAddress },
    });

    // Get real balances from both chains
    let baseBalance = BigInt(0);
    let polygonBalance = BigInt(0);

    try {
      baseBalance = await getUsdcBalance(normalizedAddress, 'base');
    } catch (err) {
      console.error('Error fetching Base balance:', err);
    }

    // If user has a proxy wallet, get its Polygon balance
    if (user?.proxyWalletAddress) {
      try {
        polygonBalance = await getUsdcBalance(user.proxyWalletAddress, 'polygon');
      } catch (err) {
        console.error('Error fetching Polygon balance:', err);
      }
    }

    // Get pending bridge amounts
    const pendingDeposits = await prisma.bridgeTransaction.aggregate({
      where: {
        userAddress: normalizedAddress,
        direction: 'deposit',
        status: { in: ['pending', 'burning', 'attesting', 'minting'] },
      },
      _sum: { amount: true },
    });

    const pendingWithdrawals = await prisma.bridgeTransaction.aggregate({
      where: {
        userAddress: normalizedAddress,
        direction: 'withdraw',
        status: { in: ['pending', 'burning', 'attesting', 'minting'] },
      },
      _sum: { amount: true },
    });

    res.json({
      success: true,
      data: {
        base: {
          balance: formatUsdcAmount(baseBalance),
          chain: 'Base',
          chainId: CCTP_CONFIG.base.chainId,
        },
        polygon: {
          balance: formatUsdcAmount(polygonBalance),
          proxyAddress: user?.proxyWalletAddress || null,
          chain: 'Polygon',
          chainId: CCTP_CONFIG.polygon.chainId,
        },
        pending: {
          deposits: pendingDeposits._sum.amount || 0,
          withdrawals: pendingWithdrawals._sum.amount || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting bridge balances:', error);
    res.status(500).json({ success: false, error: 'Failed to get balances' });
  }
});

/**
 * POST /bridge/deposit
 * Initiate a deposit from Base to Polygon
 * 
 * Body: { address: string, amount: number }
 * 
 * Flow:
 * 1. User approves USDC spend to platform wallet
 * 2. Platform receives USDC on Base
 * 3. Platform burns via CCTP
 * 4. Wait for attestation
 * 5. Mint on Polygon to user's proxy wallet
 */
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { address, amount } = req.body;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < 1) {
      return res.status(400).json({ success: false, error: 'Minimum deposit is 1 USDC' });
    }

    const normalizedAddress = getAddress(address);

    // Get user and ensure they have a proxy wallet
    const user = await prisma.user.findUnique({
      where: { baseAddress: normalizedAddress },
    });

    if (!user?.proxyWalletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'No proxy wallet found. Please connect wallet first.' 
      });
    }

    // Check user's Base USDC balance
    const baseBalance = await getUsdcBalance(normalizedAddress, 'base');
    const amountWei = parseUsdcAmount(amount);

    if (baseBalance < amountWei) {
      return res.status(400).json({
        success: false,
        error: `Insufficient USDC on Base. You have ${formatUsdcAmount(baseBalance)} USDC.`,
      });
    }

    // Create pending bridge transaction
    const bridgeTx = await prisma.bridgeTransaction.create({
      data: {
        userAddress: normalizedAddress,
        amount,
        direction: 'deposit',
        status: 'pending',
        sourceChain: 'base',
        destinationChain: 'polygon',
        destinationAddress: user.proxyWalletAddress,
      },
    });

    console.log(`[Bridge] Created deposit request ${bridgeTx.id} for ${amount} USDC`);

    // Return deposit instructions
    // User needs to send USDC to platform wallet, then we process the bridge
    res.json({
      success: true,
      data: {
        bridgeId: bridgeTx.id,
        amount,
        status: 'pending',
        instructions: {
          step: 1,
          action: 'approve_and_transfer',
          description: 'Approve and transfer USDC to platform wallet',
          platformWallet: process.env.PLATFORM_BASE_ADDRESS || 'Not configured',
          usdcContract: CCTP_CONFIG.base.usdc,
          chainId: CCTP_CONFIG.base.chainId,
        },
        destination: {
          address: user.proxyWalletAddress,
          chain: 'Polygon',
        },
        estimatedTime: '10-15 minutes',
      },
    });
  } catch (error: any) {
    console.error('Error initiating deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate deposit' });
  }
});

/**
 * POST /bridge/deposit/confirm
 * Confirm deposit after user has transferred USDC
 * 
 * Body: { bridgeId: string, txHash: string }
 */
router.post('/deposit/confirm', async (req: Request, res: Response) => {
  try {
    const { bridgeId, txHash } = req.body;

    if (!bridgeId || !txHash) {
      return res.status(400).json({ success: false, error: 'Missing bridgeId or txHash' });
    }

    // Get bridge transaction
    const bridgeTx = await prisma.bridgeTransaction.findUnique({
      where: { id: bridgeId },
    });

    if (!bridgeTx) {
      return res.status(404).json({ success: false, error: 'Bridge transaction not found' });
    }

    if (bridgeTx.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Bridge already in status: ${bridgeTx.status}` });
    }

    // Update status to burning (will be processed by worker)
    await prisma.bridgeTransaction.update({
      where: { id: bridgeId },
      data: {
        status: 'burning',
        sourceTxHash: txHash,
        updatedAt: new Date(),
      },
    });

    console.log(`[Bridge] Deposit ${bridgeId} confirmed with tx ${txHash}, queued for CCTP burn`);

    res.json({
      success: true,
      data: {
        bridgeId,
        status: 'burning',
        message: 'Deposit confirmed. Bridge process started.',
        nextStep: 'CCTP burn will be initiated. Check status for updates.',
      },
    });
  } catch (error: any) {
    console.error('Error confirming deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm deposit' });
  }
});

/**
 * GET /bridge/status/:id
 * Get status of a bridge transaction
 */
router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bridgeTx = await prisma.bridgeTransaction.findUnique({
      where: { id },
    });

    if (!bridgeTx) {
      return res.status(404).json({ success: false, error: 'Bridge transaction not found' });
    }

    // Calculate progress percentage
    const statusProgress: Record<string, number> = {
      pending: 10,
      burning: 25,
      attesting: 50,
      minting: 75,
      completed: 100,
      failed: 0,
    };

    res.json({
      success: true,
      data: {
        id: bridgeTx.id,
        amount: bridgeTx.amount,
        direction: bridgeTx.direction,
        status: bridgeTx.status,
        progress: statusProgress[bridgeTx.status] || 0,
        sourceChain: bridgeTx.sourceChain,
        sourceTxHash: bridgeTx.sourceTxHash,
        destinationChain: bridgeTx.destinationChain,
        destinationAddress: bridgeTx.destinationAddress,
        destinationTxHash: bridgeTx.destinationTxHash,
        createdAt: bridgeTx.createdAt,
        completedAt: bridgeTx.completedAt,
        error: bridgeTx.error,
      },
    });
  } catch (error: any) {
    console.error('Error getting bridge status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * GET /bridge/history/:address
 * Get user's bridge transaction history
 */
router.get('/history/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const normalizedAddress = getAddress(address);

    const transactions = await prisma.bridgeTransaction.findMany({
      where: { userAddress: normalizedAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: transactions.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        direction: tx.direction,
        status: tx.status,
        sourceChain: tx.sourceChain,
        sourceTxHash: tx.sourceTxHash,
        destinationChain: tx.destinationChain,
        destinationTxHash: tx.destinationTxHash,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error getting bridge history:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * POST /bridge/withdraw
 * Initiate a withdrawal from Polygon to Base
 * 
 * Body: { address: string, amount: number }
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { address, amount } = req.body;

    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < 1) {
      return res.status(400).json({ success: false, error: 'Minimum withdrawal is 1 USDC' });
    }

    const normalizedAddress = getAddress(address);

    // Get user
    const user = await prisma.user.findUnique({
      where: { baseAddress: normalizedAddress },
    });

    if (!user?.proxyWalletAddress || !user?.encryptedProxyKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'No proxy wallet found.' 
      });
    }

    // Check Polygon balance
    const polygonBalance = await getUsdcBalance(user.proxyWalletAddress, 'polygon');
    const amountWei = parseUsdcAmount(amount);

    if (polygonBalance < amountWei) {
      return res.status(400).json({
        success: false,
        error: `Insufficient USDC on Polygon. You have ${formatUsdcAmount(polygonBalance)} USDC.`,
      });
    }

    // Create bridge transaction
    const bridgeTx = await prisma.bridgeTransaction.create({
      data: {
        userAddress: normalizedAddress,
        amount,
        direction: 'withdraw',
        status: 'burning', // Start burning immediately since we control the wallet
        sourceChain: 'polygon',
        destinationChain: 'base',
        destinationAddress: normalizedAddress, // Send back to user's Base address
      },
    });

    console.log(`[Bridge] Created withdrawal request ${bridgeTx.id} for ${amount} USDC`);

    // Note: Actual burn will be handled by the bridge worker

    res.json({
      success: true,
      data: {
        bridgeId: bridgeTx.id,
        amount,
        status: 'burning',
        message: 'Withdrawal initiated. Processing CCTP bridge.',
        destination: normalizedAddress,
        estimatedTime: '10-15 minutes',
      },
    });
  } catch (error: any) {
    console.error('Error initiating withdrawal:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate withdrawal' });
  }
});

/**
 * GET /bridge/config
 * Get CCTP configuration for frontend
 */
router.get('/config', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      base: {
        chainId: CCTP_CONFIG.base.chainId,
        usdc: CCTP_CONFIG.base.usdc,
        domain: CCTP_CONFIG.base.domain,
      },
      polygon: {
        chainId: CCTP_CONFIG.polygon.chainId,
        usdc: CCTP_CONFIG.polygon.usdc,
        domain: CCTP_CONFIG.polygon.domain,
      },
      platformWallet: process.env.PLATFORM_BASE_ADDRESS || null,
      minDeposit: 1,
      minWithdrawal: 1,
      estimatedTime: '10-15 minutes',
    },
  });
});

export default router;

