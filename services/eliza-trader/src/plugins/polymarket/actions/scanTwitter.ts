import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger, ModelType } from '@elizaos/core';

/**
 * SCAN_TWITTER Action
 * Scans Twitter for relevant crypto/market news and analyzes trading opportunities
 */
export const scanTwitterAction: Action = {
  name: 'SCAN_TWITTER',
  similes: ['CHECK_NEWS', 'TWITTER_NEWS', 'LATEST_NEWS', 'WHATS_HAPPENING', 'MARKET_NEWS'],
  description: 'Scan Twitter/X for relevant news that could impact prediction markets',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('twitter') ||
      text.includes('news') ||
      text.includes('what\'s happening') ||
      text.includes('latest') ||
      text.includes('headlines')
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
      logger.info('Executing SCAN_TWITTER action');
      
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      
      if (!bearerToken) {
        const responseContent: Content = {
          text: '⚠️ **Twitter Not Configured**\n\nTwitter API credentials not set. I can still analyze markets based on current prices and trends.\n\n💡 Set `TWITTER_BEARER_TOKEN` to enable news scanning.',
          actions: ['SCAN_TWITTER'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'Twitter not configured',
          values: { success: false, reason: 'no_credentials' },
          data: {},
          success: false,
        };
      }
      
      const userText = message.content?.text?.toLowerCase() || '';
      
      // Determine what topics to search
      let searchQuery = 'crypto OR bitcoin OR ethereum';
      if (userText.includes('bitcoin') || userText.includes('btc')) {
        searchQuery = 'bitcoin OR BTC -is:retweet';
      } else if (userText.includes('ethereum') || userText.includes('eth')) {
        searchQuery = 'ethereum OR ETH -is:retweet';
      } else if (userText.includes('politics') || userText.includes('election')) {
        searchQuery = 'election OR politics -is:retweet';
      }
      
      try {
        // Twitter API v2 recent search
        const response = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(searchQuery)}&max_results=10&tweet.fields=created_at,public_metrics,author_id`,
          {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
            },
          }
        );
        
        if (response.status === 429) {
          const responseContent: Content = {
            text: '⚠️ **Twitter Rate Limited**\n\nTwitter API rate limit reached. Please try again in a few minutes.\n\n📊 I can still analyze Polymarket data directly - just ask!',
            actions: ['SCAN_TWITTER'],
            source: message.content.source,
          };
          await callback(responseContent);
          
          return {
            text: 'Rate limited',
            values: { success: false, reason: 'rate_limited' },
            data: {},
            success: false,
          };
        }
        
        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.status}`);
        }
        
        const data = await response.json();
        const tweets = data.data || [];
        
        if (tweets.length === 0) {
          const responseContent: Content = {
            text: '📰 **No Recent News Found**\n\nNo significant tweets found for your query. Markets may be quiet.\n\n💡 Try:\n- "Scan Bitcoin news"\n- "What\'s happening with Ethereum?"',
            actions: ['SCAN_TWITTER'],
            source: message.content.source,
          };
          await callback(responseContent);
          
          return {
            text: 'No tweets found',
            values: { success: true, tweetCount: 0 },
            data: {},
            success: true,
          };
        }
        
        // Format tweets
        const tweetSummaries = tweets.slice(0, 5).map((t: any, i: number) => {
          const engagement = t.public_metrics?.like_count + t.public_metrics?.retweet_count || 0;
          const engagementEmoji = engagement > 1000 ? '🔥' : engagement > 100 ? '📈' : '💬';
          return `${i + 1}. ${engagementEmoji} ${t.text.slice(0, 150)}${t.text.length > 150 ? '...' : ''}`;
        }).join('\n\n');
        
        // Try to generate AI summary
        let aiSummary = '';
        try {
          aiSummary = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: `Summarize these tweets and their potential market impact in 2-3 sentences:\n\n${tweetSummaries}`,
            maxTokens: 150,
          });
        } catch {
          aiSummary = '*AI summary unavailable*';
        }
        
        const responseContent: Content = {
          text: `📰 **Latest News (Twitter)**\n\n${tweetSummaries}\n\n━━━━━━━━━━━━━━━\n📊 **AI Analysis:**\n${aiSummary}\n\n💡 Want me to find related Polymarket opportunities?`,
          actions: ['SCAN_TWITTER'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: `Found ${tweets.length} relevant tweets`,
          values: { success: true, tweetCount: tweets.length },
          data: { tweets: tweets.slice(0, 5), aiSummary },
          success: true,
        };
        
      } catch (apiError) {
        logger.warn({ error: apiError }, 'Twitter API failed, using fallback');
        
        // Fallback: provide general market context
        const responseContent: Content = {
          text: `📰 **Market Context**\n\n*Twitter API unavailable. Here's what I know:*\n\n- Crypto markets are active 24/7\n- Check Polymarket for real-time sentiment\n- Consider major upcoming events\n\n💡 Ask me to "Scan Polymarket" for live market data!`,
          actions: ['SCAN_TWITTER'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'Used fallback context',
          values: { success: true, fallback: true },
          data: {},
          success: true,
        };
      }
      
    } catch (error) {
      logger.error({ error }, 'SCAN_TWITTER failed');
      
      const errorContent: Content = {
        text: `❌ **News Scan Failed**\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['SCAN_TWITTER'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Twitter scan failed',
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
        content: { text: 'What\'s the latest Bitcoin news?' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📰 **Latest News (Twitter)**\n\n1. 🔥 Bitcoin breaks $50K resistance...\n\n📊 **AI Analysis:**\nBullish sentiment emerging...',
          actions: ['SCAN_TWITTER'],
        },
      },
    ],
  ],
};
