import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { processTradeSignal } from './processors/tradeSignal';
import { getTradingConfig, logTradingModeBanner, validateLiveTradingConfig } from './lib/tradingConfig';

dotenv.config();

// ============================================================================
// Startup Banner and Configuration
// ============================================================================

console.log('');
console.log('🤖 Starting Trader Worker...');

// Get and validate trading configuration
const tradingConfig = getTradingConfig();

// Log the trading mode banner (provides clear visual indication)
logTradingModeBanner(tradingConfig);

// Validate live trading configuration if not in mock mode
if (tradingConfig.mode !== 'mock') {
  const configError = validateLiveTradingConfig(tradingConfig);
  if (configError) {
    console.error('');
    console.error('\x1b[31m❌ CONFIGURATION ERROR:\x1b[0m', configError);
    console.error('\x1b[33m   Worker will start but live orders will fail.\x1b[0m');
    console.error('\x1b[33m   Fix the configuration or switch to TRADING_MODE=mock\x1b[0m');
    console.error('');
  } else {
    console.log('\x1b[32m✓ Live trading configuration validated\x1b[0m');
    console.log(`  Max trade size: $${tradingConfig.maxTradeSizeUsd.toFixed(2)}`);
    console.log(`  Daily notional cap: $${tradingConfig.maxDailyNotionalUsd.toFixed(2)}`);
    console.log('');
  }
}

// ============================================================================
// Worker Setup
// ============================================================================

const worker = new Worker(
  'trade-signal',
  async (job) => {
    console.log(`Processing trade signal job ${job.id} for bot ${job.data.botId}`);
    await processTradeSignal(job.data);
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

console.log('Trader Worker started');

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
