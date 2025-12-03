import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ requires maxRetriesPerRequest: null for proper operation
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log(`🔗 API Redis connected to ${REDIS_URL}`);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await redis.quit();
});

