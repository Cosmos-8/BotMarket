import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';

interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomePrices: string;
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
}

/**
 * SCAN_MARKETS Action
 * Scans Polymarket for relevant prediction markets based on criteria
 */
export const scanMarketsAction: Action = {
  name: 'SCAN_MARKETS',
  similes: ['FIND_MARKETS', 'SEARCH_MARKETS', 'LIST_MARKETS', 'GET_MARKETS'],
  description: 'Scan Polymarket for active prediction markets based on keywords, categories, or price thresholds',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('scan') ||
      text.includes('find market') ||
      text.includes('search market') ||
      text.includes('what markets') ||
      text.includes('show markets') ||
      text.includes('polymarket')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Executing SCAN_MARKETS action');
      
      const text = message.content?.text?.toLowerCase() || '';
      
      // Extract keywords from the message
      const keywords: string[] = [];
      const cryptoTerms = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol'];
      const politicsTerms = ['trump', 'biden', 'election', 'president', 'political'];
      const sportsTerms = ['nfl', 'nba', 'football', 'basketball', 'sports'];
      
      if (cryptoTerms.some(term => text.includes(term))) {
        keywords.push('crypto', 'bitcoin', 'ethereum');
      }
      if (politicsTerms.some(term => text.includes(term))) {
        keywords.push('election', 'president');
      }
      if (sportsTerms.some(term => text.includes(term))) {
        keywords.push('sports');
      }
      
      // Fetch markets from Polymarket Gamma API
      const response = await fetch(
        'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50'
      );
      
      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }
      
      const allMarkets: PolymarketMarket[] = await response.json();
      
      // Filter markets based on keywords
      let filteredMarkets = allMarkets;
      if (keywords.length > 0) {
        filteredMarkets = allMarkets.filter(market => {
          const question = market.question.toLowerCase();
          return keywords.some(keyword => question.includes(keyword));
        });
      }
      
      // Parse prices and sort by volume
      const marketsWithPrices = filteredMarkets.map(market => {
        let prices: number[] = [0.5, 0.5];
        try {
          if (typeof market.outcomePrices === 'string') {
            prices = JSON.parse(market.outcomePrices);
          }
        } catch {}
        
        return {
          ...market,
          yesPrice: prices[0] || 0.5,
          noPrice: prices[1] || 0.5,
          volumeNum: parseFloat(market.volume) || 0,
        };
      });
      
      // Sort by volume and take top 10
      const topMarkets = marketsWithPrices
        .sort((a, b) => b.volumeNum - a.volumeNum)
        .slice(0, 10);
      
      // Format response
      const marketSummaries = topMarkets.map((m, i) => 
        `${i + 1}. **${m.question}**\n   YES: ${(m.yesPrice * 100).toFixed(1)}% | NO: ${(m.noPrice * 100).toFixed(1)}% | Volume: $${(m.volumeNum / 1000).toFixed(1)}K`
      ).join('\n\n');
      
      const responseText = topMarkets.length > 0
        ? `📊 **Found ${topMarkets.length} active markets:**\n\n${marketSummaries}\n\n💡 Ask me to analyze any of these markets for trading opportunities!`
        : '❌ No markets found matching your criteria. Try different keywords or ask for all active markets.';
      
      const responseContent: Content = {
        text: responseText,
        actions: ['SCAN_MARKETS'],
        source: message.content.source,
      };
      
      await callback(responseContent);
      
      return {
        text: `Scanned ${allMarkets.length} markets, found ${topMarkets.length} matching results`,
        values: {
          success: true,
          marketsFound: topMarkets.length,
          totalScanned: allMarkets.length,
        },
        data: {
          markets: topMarkets.map(m => ({
            id: m.id,
            question: m.question,
            yesPrice: m.yesPrice,
            noPrice: m.noPrice,
            volume: m.volumeNum,
          })),
        },
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'SCAN_MARKETS failed');
      
      const errorContent: Content = {
        text: `❌ Failed to scan markets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['SCAN_MARKETS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Failed to scan markets',
        values: { success: false },
        data: { error: String(error) },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Scan Polymarket for crypto markets' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Found 5 active crypto markets:**\n\n1. **Will Bitcoin reach $100K by end of 2026?**\n   YES: 65.2% | NO: 34.8% | Volume: $1.2M',
          actions: ['SCAN_MARKETS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'What markets are available on Polymarket?' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Found 10 active markets:**\n\n...',
          actions: ['SCAN_MARKETS'],
        },
      },
    ],
  ],
};
