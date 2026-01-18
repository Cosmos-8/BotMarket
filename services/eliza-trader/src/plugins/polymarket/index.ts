import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';
import { scanMarketsAction } from './actions/scanMarkets';
import { analyzeSentimentAction } from './actions/analyzeSentiment';
import { executeBuyAction, executeSellAction } from './actions/executeTrade';
import { getPositionsAction } from './actions/getPositions';
import { scanTwitterAction } from './actions/scanTwitter';
import { autonomousTradeAction } from './actions/autonomousTrade';
import { marketDataProvider } from './providers/marketData';
import { PolymarketService } from './services/polymarket';

/**
 * Polymarket Trading Plugin Configuration Schema
 */
const configSchema = z.object({
  POLYMARKET_WALLET_PRIVATE_KEY: z.string().min(1).optional(),
  POLYMARKET_BUILDER_API_KEY: z.string().optional(),
  POLYMARKET_BUILDER_SECRET: z.string().optional(),
  POLYMARKET_BUILDER_PASSPHRASE: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  MAX_TRADE_SIZE_USD: z.string().transform((val) => parseFloat(val) || 5).optional(),
  MAX_DAILY_TRADES: z.string().transform((val) => parseInt(val) || 10).optional(),
});

export type PolymarketConfig = z.infer<typeof configSchema>;

/**
 * Polymarket Trading Plugin for ElizaOS
 * 
 * This plugin enables AI agents to:
 * - Scan Polymarket for relevant prediction markets
 * - Analyze market sentiment and opportunities
 * - Execute trades (buy/sell) on Polymarket
 * - Manage positions and track performance
 */
const polymarketPlugin: Plugin = {
  name: 'polymarket',
  description: 'Trade on Polymarket prediction markets with AI-powered analysis',
  
  config: {
    POLYMARKET_WALLET_PRIVATE_KEY: process.env.POLYMARKET_WALLET_PRIVATE_KEY,
    POLYMARKET_BUILDER_API_KEY: process.env.POLYMARKET_BUILDER_API_KEY,
    POLYMARKET_BUILDER_SECRET: process.env.POLYMARKET_BUILDER_SECRET,
    POLYMARKET_BUILDER_PASSPHRASE: process.env.POLYMARKET_BUILDER_PASSPHRASE,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    MAX_TRADE_SIZE_USD: process.env.MAX_TRADE_SIZE_USD,
    MAX_DAILY_TRADES: process.env.MAX_DAILY_TRADES,
  },

  async init(config: Record<string, string>) {
    logger.info('*** Initializing Polymarket Trading Plugin ***');
    
    try {
      const validatedConfig = await configSchema.parseAsync(config);
      
      // Check for required credentials
      if (!validatedConfig.POLYMARKET_WALLET_PRIVATE_KEY) {
        logger.warn('POLYMARKET_WALLET_PRIVATE_KEY not set - trading disabled (read-only mode)');
      }
      
      if (!validatedConfig.POLYMARKET_BUILDER_API_KEY) {
        logger.warn('POLYMARKET_BUILDER_API_KEY not set - some features limited');
      }
      
      logger.info('Polymarket plugin initialized successfully');
      logger.info({
        tradingEnabled: !!validatedConfig.POLYMARKET_WALLET_PRIVATE_KEY,
        maxTradeSize: validatedConfig.MAX_TRADE_SIZE_USD || 5,
        maxDailyTrades: validatedConfig.MAX_DAILY_TRADES || 10,
      }, 'Configuration');
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ errors: error.issues }, 'Polymarket plugin configuration error');
      }
      throw error;
    }
  },

  // Custom actions for trading
  actions: [
    scanMarketsAction,
    scanTwitterAction,
    analyzeSentimentAction,
    autonomousTradeAction,
    executeBuyAction,
    executeSellAction,
    getPositionsAction,
  ],

  // Market data provider
  providers: [marketDataProvider],

  // Polymarket service for API interactions
  services: [PolymarketService],

  // API routes for external integrations
  routes: [
    {
      name: 'polymarket-markets',
      path: '/polymarket/markets',
      type: 'GET',
      handler: async (req, res) => {
        try {
          const markets = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=20')
            .then(r => r.json());
          res.json({ success: true, markets });
        } catch (error) {
          res.json({ success: false, error: String(error) });
        }
      },
    },
    {
      name: 'polymarket-positions',
      path: '/polymarket/positions',
      type: 'GET',
      handler: async (req, res) => {
        res.json({ success: true, message: 'Positions endpoint - requires wallet address' });
      },
    },
  ],

  // Event handlers
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        const text = params.message?.content?.text?.toLowerCase() || '';
        
        // Check for trading-related keywords
        if (text.includes('market') || text.includes('trade') || text.includes('buy') || text.includes('sell')) {
          logger.info('Trading-related message detected');
        }
      },
    ],
  },
};

export default polymarketPlugin;
