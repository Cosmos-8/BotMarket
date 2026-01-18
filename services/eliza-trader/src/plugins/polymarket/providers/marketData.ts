import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from '@elizaos/core';
import { logger } from '@elizaos/core';

interface MarketSnapshot {
  topMarkets: Array<{
    question: string;
    yesPrice: number;
    volume: number;
  }>;
  lastUpdated: Date;
}

let cachedMarkets: MarketSnapshot | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Market Data Provider
 * Provides real-time market context to the agent
 */
export const marketDataProvider: Provider = {
  name: 'POLYMARKET_DATA',
  description: 'Provides real-time Polymarket data and trending markets',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    try {
      const now = Date.now();
      
      // Use cached data if fresh enough
      if (cachedMarkets && (now - lastFetchTime) < CACHE_TTL) {
        return formatMarketData(cachedMarkets);
      }
      
      // Fetch fresh market data
      const response = await fetch(
        'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&order=volume&ascending=false'
      );
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }
      
      const markets = await response.json();
      
      // Parse and cache
      cachedMarkets = {
        topMarkets: markets.slice(0, 5).map((m: any) => {
          let yesPrice = 0.5;
          try {
            if (m.outcomePrices) {
              const prices = JSON.parse(m.outcomePrices);
              yesPrice = prices[0] || 0.5;
            }
          } catch {}
          
          return {
            question: m.question,
            yesPrice,
            volume: parseFloat(m.volume) || 0,
          };
        }),
        lastUpdated: new Date(),
      };
      lastFetchTime = now;
      
      return formatMarketData(cachedMarkets);
      
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch market data');
      
      return {
        text: 'Market data temporarily unavailable',
        values: { available: false },
        data: {},
      };
    }
  },
};

function formatMarketData(snapshot: MarketSnapshot): ProviderResult {
  const marketList = snapshot.topMarkets
    .map((m, i) => `${i + 1}. "${m.question}" - YES: ${(m.yesPrice * 100).toFixed(0)}%`)
    .join('\n');
  
  return {
    text: `📊 Polymarket Trending Markets (as of ${snapshot.lastUpdated.toLocaleTimeString()}):\n${marketList}`,
    values: {
      available: true,
      marketCount: snapshot.topMarkets.length,
    },
    data: {
      markets: snapshot.topMarkets,
      lastUpdated: snapshot.lastUpdated.toISOString(),
    },
  };
}
