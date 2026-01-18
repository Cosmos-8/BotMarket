import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { tradeSignalQueue } from './lib/queue';
import { generalLimiter, strictLimiter, webhookLimiter, authLimiter } from './middleware/rateLimit';
import { sanitizeInput } from './middleware/sanitize';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet()); // Sets various HTTP headers for security
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'x-wallet-address', 'x-wallet-signature', 'x-wallet-message'],
}));

// Body parsing with size limits
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Sanitize all input
app.use(sanitizeInput);

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
import botRoutes from './routes/bots';
import webhookRoutes from './routes/webhook';
import marketplaceRoutes from './routes/marketplace';
import adminRoutes from './routes/admin';
import balanceRoutes from './routes/balance';
import polymarketRoutes from './routes/polymarket';
import dashboardRoutes from './routes/dashboard';
import agentRoutes from './routes/agent';

// Routes with appropriate rate limits
app.use('/bots', botRoutes);
app.use('/webhook', webhookLimiter, webhookRoutes);  // Stricter limit for webhooks
app.use('/marketplace', marketplaceRoutes);
app.use('/admin', authLimiter, adminRoutes);  // Very strict for admin
app.use('/balance', strictLimiter, balanceRoutes);  // Strict for financial operations
app.use('/polymarket', polymarketRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/agent', strictLimiter, agentRoutes);  // Strict for AI agent operations

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
