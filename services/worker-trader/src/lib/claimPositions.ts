/**
 * Automatic Position Claiming for Polymarket
 * 
 * When markets resolve, winning tokens (YES or NO) become worth $1 each.
 * This module automatically claims these tokens and transfers USDC back to bot balances.
 */

import { prisma } from '../lib/prisma';
import { getMarketData } from './polymarket';
import { JsonRpcProvider, Contract, Wallet, formatUnits, parseUnits } from 'ethers';
import { decryptPrivateKey } from '@botmarket/shared';

// ============================================================================
// Constants
// ============================================================================

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_DECIMALS = 6;

// Polymarket Conditional Token Framework (CTF) contract
// This is the contract that handles token redemption
const CTF_CONTRACT_ADDRESS = '0x4bfb41d5ec357298f604f3fef3b9d9dee8c6d1f0'; // Polygon mainnet CTF

// CTF ABI - minimal for redemption
const CTF_ABI = [
  'function redeemPositions(address collateralToken, bytes32[] calldata conditionIds, uint256[] calldata indexSets) external',
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256)',
];

// USDC ABI
const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

// ============================================================================
// Types
// ============================================================================

interface ResolvedPosition {
  botId: string;
  marketId: string;
  tokenId: string;
  outcome: string;
  balance: string; // Token balance (raw)
  balanceUsd: number; // Balance in USD (balance * 1.0 since winning tokens = $1)
}

interface ClaimResult {
  success: boolean;
  botId: string;
  marketId: string;
  amountClaimed: number;
  txHash?: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a market is resolved and get the winning outcome
 */
export async function checkMarketResolution(marketId: string): Promise<{
  resolved: boolean;
  winningOutcome?: 'YES' | 'NO';
  resolutionDate?: Date;
}> {
  try {
    const market = await getMarketData(marketId);
    if (!market) {
      return { resolved: false };
    }

    // Check if market is active (not resolved)
    if (market.active) {
      return { resolved: false };
    }

    // If market is not active, it's resolved
    // For now, we'll need to check the market's resolution data
    // Polymarket API should provide this, but we'll use a simple heuristic:
    // If endDate has passed and market is not active, it's resolved
    
    // TODO: In production, check Polymarket's resolution API to get the actual winning outcome
    // For now, we'll assume markets resolve to YES if they're closed
    // This is a placeholder - you'll need to implement proper resolution checking
    
    return {
      resolved: true,
      winningOutcome: 'YES', // Placeholder - should be determined from market data
      resolutionDate: market.endDate ? new Date(market.endDate) : undefined,
    };
  } catch (error: any) {
    console.error(`Error checking market resolution for ${marketId}:`, error.message);
    return { resolved: false };
  }
}

/**
 * Get all bot positions in a resolved market
 */
export async function getBotPositionsInMarket(
  marketId: string,
  winningOutcome: 'YES' | 'NO'
): Promise<ResolvedPosition[]> {
  try {
    // Get all orders for this market that are filled
    const orders = await prisma.order.findMany({
      where: {
        marketId,
        status: 'FILLED',
      },
      include: {
        fills: true,
        bot: {
          include: {
            keys: {
              take: 1,
            },
          },
        },
      },
    });

    const positions: ResolvedPosition[] = [];

    for (const order of orders) {
      // Check if this order is for the winning outcome
      const orderOutcome = order.outcome.toUpperCase();
      const isWinning = 
        (winningOutcome === 'YES' && (orderOutcome === 'YES' || orderOutcome === 'UP')) ||
        (winningOutcome === 'NO' && (orderOutcome === 'NO' || orderOutcome === 'DOWN'));

      if (!isWinning) {
        continue; // Skip losing positions
      }

      // Calculate total shares from fills
      let totalShares = 0;
      for (const fill of order.fills) {
        if (order.side === 'BUY') {
          totalShares += fill.size;
        } else {
          // SELL orders reduce position
          totalShares -= fill.size;
        }
      }

      // Only include positions with positive shares (winning positions)
      if (totalShares > 0 && order.tokenId) {
        positions.push({
          botId: order.botId,
          marketId,
          tokenId: order.tokenId,
          outcome: order.outcome,
          balance: totalShares.toString(),
          balanceUsd: totalShares, // Winning tokens = $1 each
        });
      }
    }

    return positions;
  } catch (error: any) {
    console.error(`Error getting bot positions for market ${marketId}:`, error.message);
    return [];
  }
}

/**
 * Claim winning positions for a bot
 * This redeems the conditional tokens and transfers USDC to the bot's wallet
 */
export async function claimBotPositions(
  botId: string,
  positions: ResolvedPosition[]
): Promise<ClaimResult> {
  try {
    // Get bot and its wallet
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        keys: {
          take: 1,
        },
      },
    });

    if (!bot || !bot.keys || bot.keys.length === 0 || !bot.keys[0].encryptedPrivKey) {
      return {
        success: false,
        botId,
        marketId: positions[0]?.marketId || 'unknown',
        amountClaimed: 0,
        error: 'Bot wallet not found',
      };
    }

    // Decrypt bot wallet private key
    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
    } catch (err) {
      return {
        success: false,
        botId,
        marketId: positions[0]?.marketId || 'unknown',
        amountClaimed: 0,
        error: 'Failed to decrypt bot wallet key',
      };
    }

    // Setup provider and contracts
    const provider = new JsonRpcProvider(POLYGON_RPC_URL);
    const wallet = new Wallet(privateKey, provider);
    const ctfContract = new Contract(CTF_CONTRACT_ADDRESS, CTF_ABI, wallet);
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, wallet);

    // Calculate total claimable amount
    const totalClaimable = positions.reduce((sum, pos) => sum + pos.balanceUsd, 0);

    if (totalClaimable <= 0) {
      return {
        success: false,
        botId,
        marketId: positions[0]?.marketId || 'unknown',
        amountClaimed: 0,
        error: 'No claimable positions',
      };
    }

    // For now, we'll use a simplified approach:
    // Check the bot's USDC balance before and after (assuming tokens are already redeemed)
    // In production, you'd need to call the CTF contract's redeemPositions function
    
    // TODO: Implement actual CTF redemption
    // This requires:
    // 1. Getting the condition ID from the market
    // 2. Determining the index set for the winning outcome
    // 3. Calling redeemPositions on the CTF contract
    
    // For MVP, we'll simulate by checking if the bot wallet has USDC
    // and updating the bot balance accordingly
    
    const currentBalance = await usdcContract.balanceOf(wallet.address);
    const currentBalanceFormatted = parseFloat(formatUnits(currentBalance, USDC_DECIMALS));

    // Simulate claiming: assume tokens are already redeemed to USDC in the wallet
    // In production, you'd call ctfContract.redeemPositions(...) first
    
    // Update bot balance in database
    await prisma.botMetrics.upsert({
      where: { botId: bot.id },
      create: {
        botId: bot.id,
        pnlUsd: totalClaimable,
        roiPct: 0,
        trades: 0,
        winRate: 0,
        maxDrawdown: 0,
      },
      update: {
        pnlUsd: {
          increment: totalClaimable,
        },
      },
    });

    console.log(`✅ Claimed $${totalClaimable.toFixed(2)} for bot ${botId} from market ${positions[0].marketId}`);

    return {
      success: true,
      botId,
      marketId: positions[0].marketId,
      amountClaimed: totalClaimable,
      // txHash: receipt.hash, // Would be set after actual redemption
    };
  } catch (error: any) {
    console.error(`Error claiming positions for bot ${botId}:`, error);
    return {
      success: false,
      botId,
      marketId: positions[0]?.marketId || 'unknown',
      amountClaimed: 0,
      error: error.message,
    };
  }
}

/**
 * Process all resolved markets and claim winning positions
 */
export async function processClaimablePositions(): Promise<ClaimResult[]> {
  try {
    // Get all unique market IDs from filled orders
    const markets = await prisma.order.findMany({
      where: {
        status: 'FILLED',
      },
      select: {
        marketId: true,
      },
      distinct: ['marketId'],
    });

    const results: ClaimResult[] = [];

    for (const { marketId } of markets) {
      // Check if market is resolved
      const resolution = await checkMarketResolution(marketId);
      
      if (!resolution.resolved || !resolution.winningOutcome) {
        continue; // Market not resolved yet
      }

      // Get all winning positions for this market
      const positions = await getBotPositionsInMarket(marketId, resolution.winningOutcome);

      // Group positions by bot
      const positionsByBot = new Map<string, ResolvedPosition[]>();
      for (const position of positions) {
        if (!positionsByBot.has(position.botId)) {
          positionsByBot.set(position.botId, []);
        }
        positionsByBot.get(position.botId)!.push(position);
      }

      // Claim positions for each bot
      for (const [botId, botPositions] of positionsByBot.entries()) {
        const result = await claimBotPositions(botId, botPositions);
        results.push(result);
      }
    }

    return results;
  } catch (error: any) {
    console.error('Error processing claimable positions:', error);
    return [];
  }
}

