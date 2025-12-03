import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { processTradeSignal } from './processors/tradeSignal';
import { logTradingMode } from './lib/mockExecution';

dotenv.config();

console.log('');
console.log('🤖 Starting Trader Worker...');
logTradingMode();

// Create worker
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

