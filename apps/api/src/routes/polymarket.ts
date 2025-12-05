import { Router, Response, Request } from 'express';
import type { Router as IRouter } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { Currency, Timeframe } from '@botmarket/shared';

const router: IRouter = Router();

const GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';

// Cache for market data to avoid excessive API calls
interface MarketDataCache {
  data: LiveMarketData;
  fetchedAt: number;
}
const marketDataCache: Map<string, MarketDataCache> = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

/**
 * Live market data response shape
 */
interface LiveMarketData {
  question: string;
  yesPrice: number;      // 0-100 percentage
  noPrice: number;       // 0-100 percentage
  lastUpdated: string;   // ISO timestamp
  marketId: string | null;
  conditionId: string | null;
  volume24h: number;
  liquidity: number;
  endDate: string | null;
  active: boolean;
  source: 'live' | 'demo';
}

/**
 * Generate event slug for Polymarket (mirrors shared/marketDiscovery logic)
 */
function generateEventSlug(
  currency: Currency,
  timeframe: Timeframe,
  targetDate: Date
): string {
  const estDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const monthName = estDate.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = estDate.getDate();
  
  let hour = estDate.getHours();
  let minute = estDate.getMinutes();
  
  if (timeframe === '15m') {
    minute = Math.floor(minute / 15) * 15;
  } else if (timeframe === '1h') {
    minute = 0;
  } else if (timeframe === '4h') {
    hour = Math.floor(hour / 4) * 4;
    minute = 0;
  } else if (timeframe === '1d') {
    hour = 0;
    minute = 0;
  }
  
  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? 'pm' : 'am';
  const currencySlug = currency.toLowerCase();
  
  return `${currencySlug}-up-or-down-${monthName}-${day}-${hour12}${period}-et`;
}

/**
 * Map currency display name to API symbol
 */
function currencyToSymbol(currency: string): string {
  const map: Record<string, string> = {
    'Bitcoin': 'btc',
    'Ethereum': 'eth',
    'Solana': 'sol',
    'XRP': 'xrp',
  };
  return map[currency] || currency.toLowerCase();
}

/**
 * Fetch live market data from Polymarket Gamma API
 */
async function fetchLiveMarketData(
  currency: Currency,
  timeframe: Timeframe
): Promise<LiveMarketData> {
  const cacheKey = `${currency}-${timeframe}`;
  
  // Check cache
  const cached = marketDataCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const now = new Date();
    const eventSlug = generateEventSlug(currency, timeframe, now);
    
    console.log(`[Polymarket] Fetching market data for slug: ${eventSlug}`);
    
    const url = `${GAMMA_API}/events/slug/${eventSlug}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (response.status === 200 && response.data) {
      const event = response.data;
      const market = event.markets?.[0];
      
      // Calculate YES/NO prices from outcome prices if available
      let yesPrice = 50;
      let noPrice = 50;
      
      if (market?.outcomePrices) {
        // outcomePrices is typically ["0.62", "0.38"] for [YES, NO]
        const prices = market.outcomePrices;
        if (Array.isArray(prices) && prices.length >= 2) {
          yesPrice = Math.round(parseFloat(prices[0]) * 100);
          noPrice = Math.round(parseFloat(prices[1]) * 100);
        }
      } else if (market?.bestBid && market?.bestAsk) {
        // Alternative: use bid/ask midpoint
        yesPrice = Math.round(((parseFloat(market.bestBid) + parseFloat(market.bestAsk)) / 2) * 100);
        noPrice = 100 - yesPrice;
      }

      const data: LiveMarketData = {
        question: event.title || `Will ${currency} go up in the next ${timeframe}?`,
        yesPrice,
        noPrice,
        lastUpdated: new Date().toISOString(),
        marketId: market?.id || null,
        conditionId: market?.conditionId || null,
        volume24h: parseFloat(market?.volume24hr || '0'),
        liquidity: parseFloat(market?.liquidity || '0'),
        endDate: event.endDate || null,
        active: market?.active ?? true,
        source: 'live',
      };

      // Update cache
      marketDataCache.set(cacheKey, { data, fetchedAt: Date.now() });
      
      return data;
    }
  } catch (error: any) {
    console.error(`[Polymarket] Error fetching market data for ${currency}/${timeframe}:`, error.message);
  }

  // Return demo/fallback data if live fetch fails
  const demoData = generateDemoMarketData(currency, timeframe);
  marketDataCache.set(cacheKey, { data: demoData, fetchedAt: Date.now() });
  return demoData;
}

/**
 * Generate demo market data when live API is unavailable
 */
function generateDemoMarketData(currency: Currency, timeframe: Timeframe): LiveMarketData {
  // Generate somewhat realistic demo prices based on currency
  const basePrices: Record<string, number> = {
    'Bitcoin': 52,
    'Ethereum': 48,
    'Solana': 55,
    'XRP': 45,
  };
  
  // Add some randomness for demo effect
  const baseYes = basePrices[currency] || 50;
  const variance = Math.floor(Math.random() * 10) - 5;
  const yesPrice = Math.max(20, Math.min(80, baseYes + variance));
  const noPrice = 100 - yesPrice;

  const now = new Date();
  const endDate = new Date(now.getTime() + getTimeframeMs(timeframe));

  return {
    question: `Will ${currency}/USDT close above the current price at ${formatEndTime(endDate)}?`,
    yesPrice,
    noPrice,
    lastUpdated: now.toISOString(),
    marketId: `demo_${currencyToSymbol(currency)}_${timeframe}`,
    conditionId: null,
    volume24h: Math.floor(Math.random() * 50000) + 10000,
    liquidity: Math.floor(Math.random() * 100000) + 25000,
    endDate: endDate.toISOString(),
    active: true,
    source: 'demo',
  };
}

function getTimeframeMs(timeframe: Timeframe): number {
  const map: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[timeframe] || 60 * 60 * 1000;
}

function formatEndTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  }) + ' ET';
}

/**
 * GET /polymarket/market
 * Fetch live market data by currency and timeframe
 * 
 * Query params:
 * - currency: Bitcoin | Ethereum | Solana | XRP
 * - timeframe: 15m | 1h | 4h | 1d
 */
router.get('/market', async (req: Request, res: Response) => {
  try {
    const currency = req.query.currency as Currency;
    const timeframe = req.query.timeframe as Timeframe;

    if (!currency || !timeframe) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: currency, timeframe',
      });
    }

    const validCurrencies = ['Bitcoin', 'Ethereum', 'Solana', 'XRP'];
    const validTimeframes = ['15m', '1h', '4h', '1d'];

    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`,
      });
    }

    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`,
      });
    }

    const marketData = await fetchLiveMarketData(currency, timeframe);

    res.json({
      success: true,
      data: marketData,
    });
  } catch (error: any) {
    console.error('[Polymarket] Route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data',
    });
  }
});

/**
 * GET /polymarket/market/:botId
 * Fetch live market data for a specific bot's configured market
 * 
 * Extracts currency and timeframe from the bot's config
 */
router.get('/market/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    // Fetch bot with its config
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found',
      });
    }

    const config = bot.configs[0]?.configJSON as any;
    
    if (!config?.market) {
      // Try to derive market from botId (e.g., "demo_btc_4h_momentum" -> BTC, 4h)
      const derived = deriveMarketFromBotId(botId);
      if (derived) {
        const marketData = await fetchLiveMarketData(derived.currency, derived.timeframe);
        return res.json({
          success: true,
          data: marketData,
          derived: true, // Flag that we derived the market from botId
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Bot has no market configuration',
      });
    }

    const { currency, timeframe } = config.market;
    const marketData = await fetchLiveMarketData(currency, timeframe);

    res.json({
      success: true,
      data: marketData,
    });
  } catch (error: any) {
    console.error('[Polymarket] Bot market route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data for bot',
    });
  }
});

/**
 * Derive market config from botId heuristically
 * e.g., "demo_btc_4h_momentum" -> { currency: 'Bitcoin', timeframe: '4h' }
 * e.g., "bot_eth_1h_scalper" -> { currency: 'Ethereum', timeframe: '1h' }
 */
function deriveMarketFromBotId(botId: string): { currency: Currency; timeframe: Timeframe } | null {
  const lowerBotId = botId.toLowerCase();
  
  // Currency detection
  let currency: Currency | null = null;
  if (lowerBotId.includes('btc') || lowerBotId.includes('bitcoin')) {
    currency = 'Bitcoin';
  } else if (lowerBotId.includes('eth') || lowerBotId.includes('ethereum')) {
    currency = 'Ethereum';
  } else if (lowerBotId.includes('sol') || lowerBotId.includes('solana')) {
    currency = 'Solana';
  } else if (lowerBotId.includes('xrp')) {
    currency = 'XRP';
  }

  // Timeframe detection
  let timeframe: Timeframe | null = null;
  if (lowerBotId.includes('15m')) {
    timeframe = '15m';
  } else if (lowerBotId.includes('1h')) {
    timeframe = '1h';
  } else if (lowerBotId.includes('4h')) {
    timeframe = '4h';
  } else if (lowerBotId.includes('1d') || lowerBotId.includes('daily')) {
    timeframe = '1d';
  }

  // Default to 1h if no timeframe found but currency found
  if (currency && !timeframe) {
    timeframe = '1h';
  }

  // Default to Bitcoin if no currency found but we want to return something
  if (!currency && timeframe) {
    currency = 'Bitcoin';
  }

  if (currency && timeframe) {
    return { currency, timeframe };
  }

  return null;
}

/**
 * GET /polymarket/markets
 * List available markets (for discovery/debugging)
 */
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const currencies: Currency[] = ['Bitcoin', 'Ethereum', 'Solana', 'XRP'];
    const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d'];

    // Return available market combinations
    const availableMarkets = [];
    for (const currency of currencies) {
      for (const timeframe of timeframes) {
        availableMarkets.push({
          currency,
          timeframe,
          endpoint: `/polymarket/market?currency=${currency}&timeframe=${timeframe}`,
        });
      }
    }

    res.json({
      success: true,
      data: {
        availableMarkets,
        note: 'Use the endpoint or fetch by botId via /polymarket/market/:botId',
      },
    });
  } catch (error: any) {
    console.error('[Polymarket] Markets list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list markets',
    });
  }
});

export default router;

