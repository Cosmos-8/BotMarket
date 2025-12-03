import { Queue } from 'bullmq';
import { redis } from './redis';

export const tradeSignalQueue = new Queue('trade-signal', {
  connection: redis,
});

export const metricsQueue = new Queue('metrics-update', {
  connection: redis,
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await tradeSignalQueue.close();
  await metricsQueue.close();
});
