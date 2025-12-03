import { Worker } from 'bullmq';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { updateBotMetrics } from './processors/metrics';

dotenv.config();

console.log('Starting Metrics Worker...');

// Create worker
const worker = new Worker(
  'metrics-update',
  async (job) => {
    console.log(`Processing metrics update job ${job.id} for bot ${job.data.botId}`);
    await updateBotMetrics(job.data.botId);
  },
  {
    connection: redis,
    concurrency: 10,
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Metrics job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Metrics job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Metrics worker error:', err);
});

console.log('Metrics Worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down metrics worker...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

