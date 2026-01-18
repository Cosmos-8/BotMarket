import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger, ModelType } from '@elizaos/core';

/**
 * ANALYZE_SENTIMENT Action
 * Uses AI to analyze market sentiment and provide trading recommendations
 */
export const analyzeSentimentAction: Action = {
  name: 'ANALYZE_SENTIMENT',
  similes: ['ANALYZE_MARKET', 'MARKET_ANALYSIS', 'TRADING_ADVICE', 'SHOULD_I_BUY'],
  description: 'Analyze a prediction market and provide AI-powered trading recommendations',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('analyze') ||
      text.includes('should i buy') ||
      text.includes('should i sell') ||
      text.includes('what do you think') ||
      text.includes('trading advice') ||
      text.includes('recommend')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ): Promise<ActionResult> => {
    try {
      logger.info('Executing ANALYZE_SENTIMENT action');
      
      const userText = message.content?.text || '';
      
      // Try to extract a market question or topic from the message
      const marketMatch = userText.match(/(?:about|for|on)\s+"?(.+?)"?(?:\?|$|\.)/i);
      const marketTopic = marketMatch?.[1] || userText;
      
      // Fetch relevant market data if available
      let marketData = null;
      try {
        const searchResponse = await fetch(
          `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10`
        );
        
        if (searchResponse.ok) {
          const markets = await searchResponse.json();
          // Find a relevant market
          marketData = markets.find((m: any) => 
            m.question.toLowerCase().includes(marketTopic.toLowerCase().slice(0, 20))
          );
        }
      } catch (e) {
        logger.warn('Could not fetch market data for analysis');
      }
      
      // Build context for AI analysis
      const analysisContext = marketData
        ? `
Market: "${marketData.question}"
Current YES price: ${marketData.outcomePrices ? JSON.parse(marketData.outcomePrices)[0] * 100 : 'N/A'}%
Current NO price: ${marketData.outcomePrices ? JSON.parse(marketData.outcomePrices)[1] * 100 : 'N/A'}%
Volume: $${parseFloat(marketData.volume || '0').toLocaleString()}
Liquidity: $${parseFloat(marketData.liquidity || '0').toLocaleString()}
`
        : `Topic: "${marketTopic}" (no specific market found)`;
      
      // Use the LLM to generate analysis
      const prompt = `You are an expert prediction market analyst. Analyze the following and provide a trading recommendation:

${analysisContext}

User's question: "${userText}"

Provide a concise analysis covering:
1. Market sentiment assessment (bullish/bearish/neutral)
2. Key factors to consider
3. Risk assessment (low/medium/high)
4. Trading recommendation (BUY YES / BUY NO / HOLD / AVOID)
5. Confidence level (1-10)

Keep the response under 200 words. Be direct and actionable.`;

      let analysis: string;
      
      try {
        // Try to use the runtime's text generation
        analysis = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt,
          maxTokens: 500,
          temperature: 0.7,
        });
      } catch (modelError) {
        logger.warn({ error: modelError }, 'Could not use LLM, using template analysis');
        
        // Fallback template analysis
        const yesPrice = marketData?.outcomePrices 
          ? JSON.parse(marketData.outcomePrices)[0] 
          : 0.5;
        
        const sentiment = yesPrice > 0.6 ? 'bullish' : yesPrice < 0.4 ? 'bearish' : 'neutral';
        const recommendation = yesPrice < 0.3 ? 'Consider BUY YES (potential upside)' :
                              yesPrice > 0.7 ? 'Consider BUY NO (potential reversal)' :
                              'HOLD - market is fairly priced';
        
        analysis = `
📊 **Market Analysis**

**Sentiment:** ${sentiment.toUpperCase()}
**Current Price:** YES ${(yesPrice * 100).toFixed(1)}%

**Key Factors:**
- Market is currently trading ${sentiment}
- Volume indicates ${parseFloat(marketData?.volume || '0') > 100000 ? 'high' : 'moderate'} interest

**Risk Assessment:** ${yesPrice > 0.8 || yesPrice < 0.2 ? 'HIGH' : 'MEDIUM'}

**Recommendation:** ${recommendation}

**Confidence:** 6/10

⚠️ *This is AI-generated analysis. Always do your own research.*`;
      }
      
      const responseContent: Content = {
        text: analysis,
        actions: ['ANALYZE_SENTIMENT'],
        source: message.content.source,
      };
      
      await callback(responseContent);
      
      return {
        text: 'Sentiment analysis complete',
        values: {
          success: true,
          hasMarketData: !!marketData,
        },
        data: {
          market: marketData?.question,
          analysis,
        },
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'ANALYZE_SENTIMENT failed');
      
      const errorContent: Content = {
        text: `❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['ANALYZE_SENTIMENT'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Sentiment analysis failed',
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
        content: { text: 'Analyze the Bitcoin 100K market' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Market Analysis**\n\n**Sentiment:** BULLISH\n**Recommendation:** Consider BUY YES\n**Confidence:** 7/10',
          actions: ['ANALYZE_SENTIMENT'],
        },
      },
    ],
  ],
};
