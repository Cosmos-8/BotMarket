import { prisma } from '../lib/prisma';
import { cacheUpcomingMarkets, cleanupExpiredCache } from '@botmarket/shared';
import { Currency, Timeframe } from '@botmarket/shared';

/**
 * Background service to refresh market caches for all active bots
 */
export async function refreshAllBotMarkets(): Promise<void> {
  try {
    // Get all active bots
    const bots = await prisma.bot.findMany({
      include: {
        configs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Group by currency+timeframe to avoid duplicate caching
    const cacheKeys = new Set<string>();
    
    for (const bot of bots) {
      const config = bot.configs[0]?.configJSON as any;
      if (!config || !config.market) continue;
      
      const { currency, timeframe } = config.market;
      const key = `${currency}-${timeframe}`;
      
      if (!cacheKeys.has(key)) {
        cacheKeys.add(key);
        try {
          await cacheUpcomingMarkets(currency, timeframe, 24);
          console.log(`Cached markets for ${currency} ${timeframe}`);
        } catch (error) {
          console.error(`Failed to cache markets for ${currency} ${timeframe}:`, error);
        }
      }
    }

    // Clean up expired cache entries
    cleanupExpiredCache();
  } catch (error) {
    console.error('Error refreshing bot markets:', error);
  }
}

// Run every 30 minutes
setInterval(refreshAllBotMarkets, 30 * 60 * 1000);

// Run immediately on startup (after a delay)
setTimeout(refreshAllBotMarkets, 10 * 1000);

