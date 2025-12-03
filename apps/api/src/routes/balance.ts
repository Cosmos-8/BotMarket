import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress } from 'ethers';

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

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /balance/:address
 * Get USDC balance for a wallet address.
 * Creates user with 0 balance if not exists.
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

    logBalance(normalizedAddress, user.usdcBalance);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: user.usdcBalance,
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
 * GET /balance/history/:address
 * Placeholder for future transaction history
 */
router.get('/history/:address', async (req: Request, res: Response) => {
  // For hackathon MVP, just return empty history
  // In production, this would return actual funding/withdrawal transactions
  res.json({
    success: true,
    data: {
      transactions: [],
      message: 'Transaction history coming soon',
    },
  });
});

export default router;

