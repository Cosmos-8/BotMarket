import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { processTradeSignal } from './processors/tradeSignal';
import {
  getTradingConfig,
  logTradingModeBanner,
  validateLiveTradingConfig,
  validateRequiredEnvOrExit,
  TradingConfig,
} from './lib/tradingConfig';
import {
  performSafetyVerification,
  promptForLiveConfirmation,
  WalletDiagnostics,
  SafetyVerificationResult,
} from './lib/safetyVerification';
import { processClaimablePositions } from './lib/claimPositions';

dotenv.config();

// ============================================================================
// Console Colors
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ============================================================================
// Global State for Safety Verification
// ============================================================================

/**
 * Global state that tracks whether live trading is confirmed.
 * Even if TRADING_MODE=mainnet, live trading won't happen unless this is true.
 */
let liveConfirmed = false;
let effectiveMode: 'mock' | 'gamma' | 'mainnet' = 'mock';
let walletDiagnosticsCache: WalletDiagnostics | null = null;

/**
 * Get the effective trading mode (may be forced to mock if safety checks fail).
 */
export function getEffectiveMode(): 'mock' | 'gamma' | 'mainnet' {
  return effectiveMode;
}

/**
 * Check if live trading is confirmed.
 */
export function isLiveConfirmed(): boolean {
  return liveConfirmed;
}

/**
 * Get cached wallet diagnostics.
 */
export function getWalletDiagnostics(): WalletDiagnostics | null {
  return walletDiagnosticsCache;
}

// ============================================================================
// Main Startup Function
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}🤖 Starting Trader Worker...${COLORS.reset}`);
  console.log('');

  // ========================================================================
  // Step 1: Validate required environment variables
  // This will exit if mandatory vars are missing for live modes
  // ========================================================================
  validateRequiredEnvOrExit();

  // ========================================================================
  // Step 2: Get trading configuration
  // ========================================================================
  const tradingConfig = getTradingConfig();
  effectiveMode = tradingConfig.mode;

  // Log initial trading mode banner
  logTradingModeBanner(tradingConfig);

  // ========================================================================
  // Step 3: For live modes, perform safety verification
  // ========================================================================
  if (tradingConfig.mode !== 'mock') {
    // Perform full safety verification
    const verificationResult = await performSafetyVerification(tradingConfig);
    walletDiagnosticsCache = verificationResult.walletDiagnostics;

    // If safety verification failed, force mock mode
    if (verificationResult.forceMockMode) {
      console.log(`${COLORS.yellow}⚠️  Due to safety verification issues, falling back to MOCK mode.${COLORS.reset}`);
      console.log(`${COLORS.yellow}   Fix the issues above to enable ${tradingConfig.mode.toUpperCase()} trading.${COLORS.reset}`);
      console.log('');
      effectiveMode = 'mock';
    } else {
      // Safety verification passed - prompt for confirmation
      const confirmed = await promptForLiveConfirmation(tradingConfig, walletDiagnosticsCache);
      
      if (confirmed) {
        liveConfirmed = true;
        effectiveMode = tradingConfig.mode;
        console.log(`${COLORS.green}✅ Live trading enabled for ${effectiveMode.toUpperCase()} mode.${COLORS.reset}`);
      } else {
        console.log(`${COLORS.yellow}⚠️  Live trading not confirmed. Running in MOCK mode.${COLORS.reset}`);
        effectiveMode = 'mock';
      }
    }
    console.log('');
  }

  // ========================================================================
  // Step 4: Final configuration validation
  // ========================================================================
  if (effectiveMode !== 'mock') {
    const configError = validateLiveTradingConfig(tradingConfig);
    if (configError) {
      console.error('');
      console.error(`${COLORS.red}❌ CONFIGURATION ERROR:${COLORS.reset}`, configError);
      console.error(`${COLORS.yellow}   Worker will start but live orders will fail.${COLORS.reset}`);
      console.error(`${COLORS.yellow}   Fix the configuration or switch to TRADING_MODE=mock${COLORS.reset}`);
      console.error('');
    } else {
      console.log(`${COLORS.green}✓ Live trading configuration validated${COLORS.reset}`);
      console.log(`  Max trade size: $${tradingConfig.maxTradeSizeUsd.toFixed(2)}`);
      console.log(`  Daily notional cap: $${tradingConfig.maxDailyNotionalUsd.toFixed(2)}`);
      console.log('');
    }
  }

  // ========================================================================
  // Step 5: Display final effective mode
  // ========================================================================
  console.log(`${COLORS.bright}${COLORS.blue}╔══════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  if (effectiveMode === 'mock') {
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.green}✅ Worker starting in MOCK mode${COLORS.reset}                                   ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     All trades will be simulated locally.                             ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
  } else {
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.red}🔴 Worker starting in ${effectiveMode.toUpperCase()} mode${COLORS.reset}                                 ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     ${COLORS.bright}REAL orders will be submitted to Polymarket!${COLORS.reset}                    ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
  }
  console.log(`${COLORS.bright}${COLORS.blue}╚══════════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log('');

  // ========================================================================
  // Step 6: Initialize Worker
  // ========================================================================
const worker = new Worker(
  'trade-signal',
  async (job) => {
    console.log(`Processing trade signal job ${job.id} for bot ${job.data.botId}`);
      
      // Pass effective mode and wallet diagnostics to the processor
      await processTradeSignal(job.data, {
        effectiveMode,
        liveConfirmed,
        walletDiagnostics: walletDiagnosticsCache,
      });
  },
  {
    connection: redis,
    concurrency: 5,
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

  console.log(`${COLORS.green}✅ Trader Worker started and listening for signals...${COLORS.reset}`);
  console.log('');

  // ========================================================================
  // Step 7: Start Position Claiming Worker (runs every hour)
  // ========================================================================
  console.log(`${COLORS.cyan}💰 Starting automatic position claiming worker...${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Checking for claimable positions every hour${COLORS.reset}`);
  console.log('');

  // Run immediately on startup, then every hour
  const claimPositions = async () => {
    try {
      console.log(`${COLORS.cyan}🔍 Checking for claimable positions...${COLORS.reset}`);
      const results = await processClaimablePositions();
      
      if (results.length > 0) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`${COLORS.green}✅ Claimed positions for ${successful.length} bot(s)${COLORS.reset}`);
        if (failed.length > 0) {
          console.log(`${COLORS.yellow}⚠️  Failed to claim positions for ${failed.length} bot(s)${COLORS.reset}`);
        }
        
        // Log details
        for (const result of successful) {
          console.log(`   Bot ${result.botId}: Claimed $${result.amountClaimed.toFixed(2)} from market ${result.marketId}`);
        }
      } else {
        console.log(`${COLORS.cyan}   No claimable positions found${COLORS.reset}`);
      }
    } catch (error: any) {
      console.error(`${COLORS.red}❌ Error processing claimable positions:${COLORS.reset}`, error);
    }
  };

  // Run immediately
  claimPositions();

  // Then run every 15 minutes (900000 ms) to catch resolved markets faster
  const claimInterval = setInterval(claimPositions, 15 * 60 * 1000);

  // ========================================================================
  // Graceful Shutdown
  // ========================================================================
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down worker...`);
    clearInterval(claimInterval);
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ============================================================================
// Run Main
// ============================================================================

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error starting worker:${COLORS.reset}`, error);
  process.exit(1);
});
