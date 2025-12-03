import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { tradeSignalQueue } from './lib/queue';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: redis.status === 'ready' ? 'connected' : 'disconnected',
    },
  });
});

// Routes
import authRoutes from './routes/auth';
import botRoutes from './routes/bots';
import webhookRoutes from './routes/webhook';
import marketplaceRoutes from './routes/marketplace';
import adminRoutes from './routes/admin';
import balanceRoutes from './routes/balance';

app.use('/auth', authRoutes);
app.use('/bots', botRoutes);
app.use('/webhook', webhookRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/admin', adminRoutes);
app.use('/balance', balanceRoutes);

// Start market cache service
import './services/marketCacheService';

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  await redis.quit();
  await tradeSignalQueue.close();
  process.exit(0);
});

export { app, prisma, redis };

