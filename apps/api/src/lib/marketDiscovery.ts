import axios from 'axios';
import { Currency, Timeframe } from '@botmarket/shared';

const GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';

interface CachedMarket {
  marketId: string;
  eventSlug: string;
  title: string;
  active: boolean;
  discoveredAt: string;
  expiresAt: string; // When this market expires
}

interface MarketCache {
  [key: string]: CachedMarket; // key: "currency-timeframe-timestamp"
}

// In-memory cache (in production, use Redis)
const marketCache: MarketCache = {};

/**
 * Generate event slug for Polymarket
 * Format: {currency}-up-or-down-{month}-{day}-{hour}{period}-et
 */
function generateEventSlug(
  currency: Currency,
  timeframe: Timeframe,
  targetDate: Date
): string {
  const estDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const monthName = estDate.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const day = estDate.getDate();
  
  // For different timeframes, adjust the hour
  let hour = estDate.getHours();
  let minute = estDate.getMinutes();
  
  // Round to nearest timeframe
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
 * Generate cache key for market
 */
function generateCacheKey(
  currency: Currency,
  timeframe: Timeframe,
  targetDate: Date
): string {
  const estDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  // Round to timeframe
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
  
  const dateStr = estDate.toISOString().split('T')[0];
  return `${currency}-${timeframe}-${dateStr}-${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}`;
}

/**
 * Fetch market by event slug from Polymarket
 */
async function fetchMarketBySlug(eventSlug: string): Promise<CachedMarket | null> {
  try {
    const url = `${GAMMA_API}/events/slug/${eventSlug}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (response.status === 200 && response.data.markets && response.data.markets.length > 0) {
      const market = response.data.markets[0];
      
      // Calculate expiration time (when this market period ends)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // Default 1 hour, adjust based on timeframe
      
      return {
        marketId: market.id,
        eventSlug,
        title: response.data.title || '',
        active: market.active || false,
        discoveredAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    }
  } catch (error: any) {
    console.error(`Error fetching market for slug ${eventSlug}:`, error.message);
  }
  
  return null;
}

/**
 * Get current market ID for a currency and timeframe
 */
export async function getCurrentMarketId(
  currency: Currency,
  timeframe: Timeframe
): Promise<string | null> {
  const now = new Date();
  const cacheKey = generateCacheKey(currency, timeframe, now);
  
  // Check cache first
  if (marketCache[cacheKey]) {
    const cached = marketCache[cacheKey];
    // Check if cache is still valid (not expired)
    if (new Date(cached.expiresAt) > now && cached.active) {
      return cached.marketId;
    }
    // Remove expired cache
    delete marketCache[cacheKey];
  }
  
  // Discover current market
  const eventSlug = generateEventSlug(currency, timeframe, now);
  const market = await fetchMarketBySlug(eventSlug);
  
  if (market) {
    marketCache[cacheKey] = market;
    return market.marketId;
  }
  
  return null;
}

/**
 * Get upcoming market ID (for caching)
 */
export async function getUpcomingMarketId(
  currency: Currency,
  timeframe: Timeframe,
  hoursAhead: number = 1
): Promise<string | null> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const cacheKey = generateCacheKey(currency, timeframe, futureDate);
  
  // Check cache
  if (marketCache[cacheKey]) {
    return marketCache[cacheKey].marketId;
  }
  
  // Discover future market
  const eventSlug = generateEventSlug(currency, timeframe, futureDate);
  const market = await fetchMarketBySlug(eventSlug);
  
  if (market) {
    marketCache[cacheKey] = market;
    return market.marketId;
  }
  
  return null;
}

/**
 * Pre-cache upcoming markets for a bot
 */
export async function cacheUpcomingMarkets(
  currency: Currency,
  timeframe: Timeframe,
  hoursAhead: number = 24
): Promise<void> {
  const now = new Date();
  
  for (let i = 0; i < hoursAhead; i++) {
    const targetDate = new Date(now.getTime() + i * 60 * 60 * 1000);
    const cacheKey = generateCacheKey(currency, timeframe, targetDate);
    
    // Skip if already cached
    if (marketCache[cacheKey]) {
      continue;
    }
    
    // Discover and cache
    const eventSlug = generateEventSlug(currency, timeframe, targetDate);
    const market = await fetchMarketBySlug(eventSlug);
    
    if (market) {
      marketCache[cacheKey] = market;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(): void {
  const now = new Date();
  const keysToDelete: string[] = [];
  
  for (const [key, market] of Object.entries(marketCache)) {
    if (new Date(market.expiresAt) < now) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => delete marketCache[key]);
  
  if (keysToDelete.length > 0) {
    console.log(`Cleaned up ${keysToDelete.length} expired market cache entries`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredCache, 60 * 60 * 1000);

