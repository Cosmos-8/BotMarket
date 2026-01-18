import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { ethers } from 'ethers';

interface TradingConfig {
  enabled: boolean;
  maxTradeSize: number;
  maxDailyTrades: number;
  tradesToday: number;
}

/**
 * Polymarket Service
 * Handles Polymarket API connections, wallet management, and trading state
 */
export class PolymarketService extends Service {
  static serviceType = 'polymarket';
  capabilityDescription = 'Polymarket trading service for prediction market operations';

  private wallet: ethers.Wallet | null = null;
  private tradingConfig: TradingConfig;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    
    this.tradingConfig = {
      enabled: false,
      maxTradeSize: parseFloat(process.env.MAX_TRADE_SIZE_USD || '10'),
      maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '10'),
      tradesToday: 0,
    };
  }

  static async start(runtime: IAgentRuntime): Promise<PolymarketService> {
    logger.info('🚀 Starting Polymarket Service');
    
    const service = new PolymarketService(runtime);
    await service.initialize();
    
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('⏹️ Stopping Polymarket Service');
    
    const service = runtime.getService(PolymarketService.serviceType) as PolymarketService;
    if (service) {
      await service.cleanup();
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Polymarket service...');
    
    // Initialize wallet if private key is provided
    const privateKey = process.env.POLYMARKET_WALLET_PRIVATE_KEY;
    
    if (privateKey) {
      try {
        // Connect to Polygon mainnet
        const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        this.wallet = new ethers.Wallet(privateKey, provider);
        
        const address = await this.wallet.getAddress();
        const balance = await provider.getBalance(address);
        
        logger.info({
          address,
          balance: ethers.formatEther(balance),
        }, '💳 Wallet connected');
        
        this.tradingConfig.enabled = true;
      } catch (error) {
        logger.error({ error }, 'Failed to initialize wallet');
        this.tradingConfig.enabled = false;
      }
    } else {
      logger.warn('No wallet private key configured - running in read-only mode');
    }
    
    // Start market scanning if configured
    if (process.env.AUTO_SCAN_ENABLED === 'true') {
      this.startAutoScan();
    }
    
    logger.info({
      tradingEnabled: this.tradingConfig.enabled,
      maxTradeSize: this.tradingConfig.maxTradeSize,
      maxDailyTrades: this.tradingConfig.maxDailyTrades,
    }, '✅ Polymarket service initialized');
  }

  async cleanup(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    logger.info('Polymarket service cleaned up');
  }

  async stop(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Start automatic market scanning
   */
  private startAutoScan(): void {
    const scanIntervalMs = parseInt(process.env.SCAN_INTERVAL_MINUTES || '15') * 60 * 1000;
    
    logger.info({ intervalMinutes: scanIntervalMs / 60000 }, 'Starting auto-scan');
    
    this.scanInterval = setInterval(async () => {
      await this.scanForOpportunities();
    }, scanIntervalMs);
    
    // Initial scan
    setTimeout(() => this.scanForOpportunities(), 5000);
  }

  /**
   * Scan markets for trading opportunities
   */
  private async scanForOpportunities(): Promise<void> {
    try {
      logger.info('🔍 Scanning markets for opportunities...');
      
      const response = await fetch(
        'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50'
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const markets = await response.json();
      
      // Find markets with potential opportunities
      // (e.g., extreme prices, high volume changes)
      const opportunities = markets.filter((m: any) => {
        try {
          const prices = JSON.parse(m.outcomePrices || '[]');
          const yesPrice = prices[0] || 0.5;
          const volume = parseFloat(m.volume) || 0;
          
          // Look for:
          // 1. Extreme prices (< 10% or > 90%)
          // 2. High volume (> $50k)
          return (yesPrice < 0.1 || yesPrice > 0.9) && volume > 50000;
        } catch {
          return false;
        }
      });
      
      if (opportunities.length > 0) {
        logger.info({ count: opportunities.length }, '📈 Found trading opportunities');
        // In production, this could trigger the decision engine
      } else {
        logger.info('No significant opportunities found');
      }
      
    } catch (error) {
      logger.error({ error }, 'Market scan failed');
    }
  }

  /**
   * Get current trading configuration
   */
  getTradingConfig(): TradingConfig {
    return { ...this.tradingConfig };
  }

  /**
   * Check if trading is allowed
   */
  canTrade(amount: number): { allowed: boolean; reason?: string } {
    if (!this.tradingConfig.enabled) {
      return { allowed: false, reason: 'Trading not enabled' };
    }
    
    if (amount > this.tradingConfig.maxTradeSize) {
      return { allowed: false, reason: `Amount exceeds max trade size ($${this.tradingConfig.maxTradeSize})` };
    }
    
    if (this.tradingConfig.tradesToday >= this.tradingConfig.maxDailyTrades) {
      return { allowed: false, reason: 'Daily trade limit reached' };
    }
    
    return { allowed: true };
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }
}
