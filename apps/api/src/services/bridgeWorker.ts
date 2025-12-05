/**
 * Bridge Worker Service
 * 
 * Background service that processes CCTP bridge transactions:
 * 1. Monitors for deposits that need CCTP burn
 * 2. Polls for Circle attestations
 * 3. Completes mints on destination chain
 * 
 * Runs as a background job within the API server.
 */

import { prisma } from '../lib/prisma';
import cctp, { getWallet, getAttestation, CCTP_CONFIG } from '../lib/cctp';
import { decryptPrivateKey } from '@botmarket/shared';
import { ethers } from 'ethers';

// Configuration
const POLL_INTERVAL_MS = 30000; // 30 seconds
const PLATFORM_BASE_PRIVATE_KEY = process.env.PLATFORM_BASE_PRIVATE_KEY;
const PLATFORM_POLYGON_PRIVATE_KEY = process.env.PLATFORM_POLYGON_PRIVATE_KEY;
const BOT_KEY_ENCRYPTION_SECRET = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret';

let isRunning = false;

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Process deposits in "burning" status
 * - Initiate CCTP burn on Base
 * - Update status to "attesting"
 */
async function processBurningDeposits(): Promise<void> {
  if (!PLATFORM_BASE_PRIVATE_KEY) {
    console.log('[BridgeWorker] No platform Base wallet configured, skipping burns');
    return;
  }

  const deposits = await prisma.bridgeTransaction.findMany({
    where: {
      direction: 'deposit',
      status: 'burning',
    },
    take: 5,
  });

  for (const deposit of deposits) {
    try {
      console.log(`[BridgeWorker] Processing deposit ${deposit.id} for ${deposit.amount} USDC`);
      
      const platformWallet = getWallet(PLATFORM_BASE_PRIVATE_KEY, 'base');
      const amountWei = BigInt(Math.floor(deposit.amount * 1e6));

      // Initiate CCTP burn
      const result = await cctp.initiateBridgeToPolygon(
        platformWallet,
        deposit.destinationAddress,
        amountWei
      );

      // Update transaction with message details
      await prisma.bridgeTransaction.update({
        where: { id: deposit.id },
        data: {
          status: 'attesting',
          sourceTxHash: result.txHash,
          messageBytes: result.messageBytes,
          messageHash: result.messageHash,
          updatedAt: new Date(),
        },
      });

      console.log(`[BridgeWorker] Deposit ${deposit.id} burned, tx: ${result.txHash}`);
      console.log(`[BridgeWorker] Waiting for attestation: ${result.messageHash}`);
    } catch (error: any) {
      console.error(`[BridgeWorker] Error processing deposit ${deposit.id}:`, error);
      
      await prisma.bridgeTransaction.update({
        where: { id: deposit.id },
        data: {
          status: 'failed',
          error: error.message,
          updatedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Process withdrawals in "burning" status
 * - Initiate CCTP burn on Polygon using user's proxy wallet
 */
async function processBurningWithdrawals(): Promise<void> {
  const withdrawals = await prisma.bridgeTransaction.findMany({
    where: {
      direction: 'withdraw',
      status: 'burning',
    },
    include: {
      user: true,
    },
    take: 5,
  });

  for (const withdrawal of withdrawals) {
    try {
      if (!withdrawal.user?.encryptedProxyKey) {
        throw new Error('User proxy wallet not found');
      }

      console.log(`[BridgeWorker] Processing withdrawal ${withdrawal.id} for ${withdrawal.amount} USDC`);
      
      // Decrypt user's proxy wallet key
      const privateKey = decryptPrivateKey(
        withdrawal.user.encryptedProxyKey,
        BOT_KEY_ENCRYPTION_SECRET
      );
      
      const userWallet = getWallet(privateKey, 'polygon');
      const amountWei = BigInt(Math.floor(withdrawal.amount * 1e6));

      // Initiate CCTP burn on Polygon
      const result = await cctp.burnUsdcForBridge(
        userWallet,
        amountWei,
        withdrawal.destinationAddress, // User's Base address
        'polygon'
      );

      // Update transaction
      await prisma.bridgeTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: 'attesting',
          sourceTxHash: result.txHash,
          messageBytes: result.messageBytes,
          messageHash: result.messageHash,
          nonce: result.nonce,
          updatedAt: new Date(),
        },
      });

      console.log(`[BridgeWorker] Withdrawal ${withdrawal.id} burned, tx: ${result.txHash}`);
    } catch (error: any) {
      console.error(`[BridgeWorker] Error processing withdrawal ${withdrawal.id}:`, error);
      
      await prisma.bridgeTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          error: error.message,
          updatedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Process transactions waiting for attestation
 * - Poll Circle for attestation
 * - When ready, update status to "minting"
 */
async function processAttestingTransactions(): Promise<void> {
  const transactions = await prisma.bridgeTransaction.findMany({
    where: {
      status: 'attesting',
      messageHash: { not: null },
    },
    take: 10,
  });

  for (const tx of transactions) {
    if (!tx.messageHash) continue;

    try {
      console.log(`[BridgeWorker] Checking attestation for ${tx.id}: ${tx.messageHash}`);
      
      const attestation = await getAttestation(tx.messageHash);

      if (attestation.status === 'complete' && attestation.attestation) {
        console.log(`[BridgeWorker] Attestation received for ${tx.id}`);
        
        await prisma.bridgeTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'minting',
            attestation: attestation.attestation,
            updatedAt: new Date(),
          },
        });
      } else {
        console.log(`[BridgeWorker] Attestation pending for ${tx.id}`);
      }
    } catch (error: any) {
      console.error(`[BridgeWorker] Error checking attestation for ${tx.id}:`, error);
    }
  }
}

/**
 * Process transactions ready for minting
 * - Call receiveMessage on destination chain
 * - Update user balance
 */
async function processMintingTransactions(): Promise<void> {
  const transactions = await prisma.bridgeTransaction.findMany({
    where: {
      status: 'minting',
      messageBytes: { not: null },
      attestation: { not: null },
    },
    include: {
      user: true,
    },
    take: 5,
  });

  for (const tx of transactions) {
    if (!tx.messageBytes || !tx.attestation) continue;

    try {
      console.log(`[BridgeWorker] Minting ${tx.id} on ${tx.destinationChain}`);
      
      let wallet;
      if (tx.direction === 'deposit') {
        // For deposits, we need to mint on Polygon
        // We can use platform wallet or anyone can call receiveMessage
        if (!PLATFORM_POLYGON_PRIVATE_KEY) {
          console.log('[BridgeWorker] No platform Polygon wallet, skipping mint');
          continue;
        }
        wallet = getWallet(PLATFORM_POLYGON_PRIVATE_KEY, 'polygon');
      } else {
        // For withdrawals, mint on Base
        if (!PLATFORM_BASE_PRIVATE_KEY) {
          console.log('[BridgeWorker] No platform Base wallet, skipping mint');
          continue;
        }
        wallet = getWallet(PLATFORM_BASE_PRIVATE_KEY, 'base');
      }

      const destChain = tx.destinationChain as 'base' | 'polygon';
      const mintTxHash = await cctp.mintUsdc(wallet, tx.messageBytes, tx.attestation, destChain);

      // Update transaction as completed
      await prisma.bridgeTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'completed',
          destinationTxHash: mintTxHash,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Update user's balance in database
      if (tx.direction === 'deposit') {
        await prisma.user.update({
          where: { baseAddress: tx.userAddress },
          data: {
            usdcBalance: { increment: tx.amount },
          },
        });
      } else {
        await prisma.user.update({
          where: { baseAddress: tx.userAddress },
          data: {
            usdcBalance: { decrement: tx.amount },
          },
        });
      }

      console.log(`[BridgeWorker] ${tx.direction} ${tx.id} completed! Mint tx: ${mintTxHash}`);
    } catch (error: any) {
      console.error(`[BridgeWorker] Error minting ${tx.id}:`, error);
      
      // Don't mark as failed immediately - might be a temporary RPC error
      // The worker will retry on next poll
    }
  }
}

// ============================================================================
// Main Worker Loop
// ============================================================================

async function runWorkerCycle(): Promise<void> {
  try {
    // Process each stage
    await processBurningDeposits();
    await processBurningWithdrawals();
    await processAttestingTransactions();
    await processMintingTransactions();
  } catch (error) {
    console.error('[BridgeWorker] Error in worker cycle:', error);
  }
}

/**
 * Start the bridge worker
 */
export function startBridgeWorker(): void {
  if (isRunning) {
    console.log('[BridgeWorker] Already running');
    return;
  }

  console.log('[BridgeWorker] Starting CCTP bridge worker...');
  console.log(`[BridgeWorker] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[BridgeWorker] Platform Base wallet: ${PLATFORM_BASE_PRIVATE_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`[BridgeWorker] Platform Polygon wallet: ${PLATFORM_POLYGON_PRIVATE_KEY ? 'Configured' : 'NOT CONFIGURED'}`);

  isRunning = true;

  // Initial run
  runWorkerCycle();

  // Schedule periodic runs
  setInterval(() => {
    if (isRunning) {
      runWorkerCycle();
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the bridge worker
 */
export function stopBridgeWorker(): void {
  console.log('[BridgeWorker] Stopping...');
  isRunning = false;
}

export default {
  startBridgeWorker,
  stopBridgeWorker,
};

