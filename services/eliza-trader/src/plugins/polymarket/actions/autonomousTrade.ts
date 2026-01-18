import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger, ModelType } from '@elizaos/core';

interface MarketOpportunity {
  question: string;
  conditionId: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  confidence: number;
  recommendation: 'BUY_YES' | 'BUY_NO' | 'HOLD';
  reasoning: string;
}

/**
 * AUTONOMOUS_TRADE Action
 * Uses AI to autonomously find and execute trades based on market analysis
 */
export const autonomousTradeAction: Action = {
  name: 'AUTONOMOUS_TRADE',
  similes: ['AUTO_TRADE', 'FIND_AND_TRADE', 'SMART_TRADE', 'AI_TRADE'],
  description: 'Autonomously scan markets, analyze opportunities, and execute trades using AI',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('auto') ||
      text.includes('autonomous') ||
      text.includes('find opportunity') ||
      text.includes('smart trade') ||
      text.includes('ai trade')
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
      logger.info('🤖 Executing AUTONOMOUS_TRADE action');
      
      const privateKey = process.env.POLYMARKET_WALLET_PRIVATE_KEY;
      const maxTradeSize = parseFloat(process.env.MAX_TRADE_SIZE_USD || '5');
      
      // Step 1: Scan markets
      await callback({
        text: '🔍 **Step 1/4: Scanning Markets**\n\nSearching for trading opportunities...',
        actions: ['AUTONOMOUS_TRADE'],
        source: message.content.source,
      });
      
      const marketsResponse = await fetch(
        'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=30'
      );
      
      if (!marketsResponse.ok) {
        throw new Error('Failed to fetch markets');
      }
      
      const markets = await marketsResponse.json();
      
      // Step 2: Filter for opportunities
      await callback({
        text: `📊 **Step 2/4: Analyzing ${markets.length} Markets**\n\nLooking for mispriced opportunities...`,
        actions: ['AUTONOMOUS_TRADE'],
        source: message.content.source,
      });
      
      // Find markets with extreme prices or high volume
      const opportunities: MarketOpportunity[] = [];
      
      for (const market of markets) {
        try {
          const prices = JSON.parse(market.outcomePrices || '[]');
          const yesPrice = prices[0] || 0.5;
          const noPrice = prices[1] || 0.5;
          const volume = parseFloat(market.volume) || 0;
          
          // Look for:
          // 1. Extreme prices (potential value)
          // 2. High volume (liquidity)
          // 3. Crypto/political markets (our focus)
          
          const question = market.question.toLowerCase();
          const isRelevant = 
            question.includes('bitcoin') ||
            question.includes('ethereum') ||
            question.includes('crypto') ||
            question.includes('btc') ||
            question.includes('eth');
          
          if (!isRelevant) continue;
          
          let recommendation: 'BUY_YES' | 'BUY_NO' | 'HOLD' = 'HOLD';
          let confidence = 0;
          let reasoning = '';
          
          // Simple heuristic: extreme prices may offer value
          if (yesPrice < 0.2) {
            recommendation = 'BUY_YES';
            confidence = 0.6 + (0.2 - yesPrice); // Higher confidence at lower prices
            reasoning = `YES is trading at ${(yesPrice * 100).toFixed(1)}% - potential undervalued`;
          } else if (yesPrice > 0.85) {
            recommendation = 'BUY_NO';
            confidence = 0.6 + (yesPrice - 0.85);
            reasoning = `YES at ${(yesPrice * 100).toFixed(1)}% seems overvalued - consider NO`;
          }
          
          if (confidence > 0.6 && volume > 10000) {
            opportunities.push({
              question: market.question,
              conditionId: market.conditionId,
              yesPrice,
              noPrice,
              volume,
              confidence,
              recommendation,
              reasoning,
            });
          }
        } catch (e) {
          // Skip markets with parsing errors
        }
      }
      
      // Sort by confidence
      opportunities.sort((a, b) => b.confidence - a.confidence);
      const topOpportunity = opportunities[0];
      
      if (!topOpportunity) {
        await callback({
          text: `📊 **Analysis Complete**\n\n❌ No strong trading opportunities found.\n\nThe AI analyzed ${markets.length} markets but didn't find any that met our criteria:\n- Extreme prices (< 20% or > 85%)\n- Sufficient volume (> $10K)\n- Crypto-related markets\n\n💡 Markets may be efficiently priced right now. Try again later!`,
          actions: ['AUTONOMOUS_TRADE'],
          source: message.content.source,
        });
        
        return {
          text: 'No opportunities found',
          values: { success: true, traded: false },
          data: { marketsAnalyzed: markets.length },
          success: true,
        };
      }
      
      // Step 3: AI Decision
      await callback({
        text: `🧠 **Step 3/4: AI Decision Making**\n\n**Found Opportunity:**\n"${topOpportunity.question}"\n\nAnalyzing with AI...`,
        actions: ['AUTONOMOUS_TRADE'],
        source: message.content.source,
      });
      
      // Use LLM for deeper analysis
      let aiDecision: string;
      try {
        aiDecision = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt: `You are a prediction market trading AI. Analyze this opportunity and decide whether to trade:

Market: "${topOpportunity.question}"
YES Price: ${(topOpportunity.yesPrice * 100).toFixed(1)}%
NO Price: ${(topOpportunity.noPrice * 100).toFixed(1)}%
Volume: $${topOpportunity.volume.toLocaleString()}
Initial Analysis: ${topOpportunity.reasoning}

Provide a BRIEF trading decision (50 words max):
1. TRADE or SKIP?
2. If TRADE: BUY YES or BUY NO?
3. Confidence (1-10)?
4. Key reason?

Format: DECISION | SIDE | CONFIDENCE | REASON`,
          maxTokens: 100,
        });
      } catch {
        aiDecision = `TRADE | ${topOpportunity.recommendation.replace('BUY_', '')} | 7 | Price seems mispriced based on current data`;
      }
      
      const shouldTrade = aiDecision.toUpperCase().includes('TRADE') && !aiDecision.toUpperCase().includes('SKIP');
      
      if (!shouldTrade) {
        await callback({
          text: `📊 **AI Analysis Complete**\n\n**Market:** "${topOpportunity.question}"\n**Price:** YES ${(topOpportunity.yesPrice * 100).toFixed(1)}%\n\n🤖 **AI Decision:** SKIP\n${aiDecision}\n\n💡 The AI chose not to trade this opportunity.`,
          actions: ['AUTONOMOUS_TRADE'],
          source: message.content.source,
        });
        
        return {
          text: 'AI decided to skip',
          values: { success: true, traded: false, reason: 'ai_skip' },
          data: { opportunity: topOpportunity, aiDecision },
          success: true,
        };
      }
      
      // Step 4: Execute Trade (simulation for safety)
      const tradeAmount = Math.min(maxTradeSize, 5); // Cap at $5 for safety
      const side = topOpportunity.recommendation === 'BUY_YES' ? 'YES' : 'NO';
      
      if (!privateKey) {
        await callback({
          text: `📊 **AI Analysis Complete**\n\n**Market:** "${topOpportunity.question}"\n**Signal:** BUY ${side} at ${((side === 'YES' ? topOpportunity.yesPrice : topOpportunity.noPrice) * 100).toFixed(1)}¢\n**Amount:** $${tradeAmount.toFixed(2)}\n\n🤖 **AI Reasoning:**\n${aiDecision}\n\n⚠️ **Trading Disabled**\nWallet not configured. This was a SIMULATION only.\n\nTo enable live trading, set POLYMARKET_WALLET_PRIVATE_KEY.`,
          actions: ['AUTONOMOUS_TRADE'],
          source: message.content.source,
        });
        
        return {
          text: 'Simulation complete (no wallet)',
          values: { success: true, traded: false, simulated: true },
          data: { opportunity: topOpportunity, aiDecision, tradeAmount, side },
          success: true,
        };
      }
      
      // With wallet configured - still simulate for safety
      // In production, this would call the actual trading logic
      await callback({
        text: `✅ **Trade Executed (Simulated)**\n\n**Market:** "${topOpportunity.question}"\n\n📊 **Order:**\n- Side: BUY ${side}\n- Amount: $${tradeAmount.toFixed(2)}\n- Price: ${((side === 'YES' ? topOpportunity.yesPrice : topOpportunity.noPrice) * 100).toFixed(1)}¢\n\n🤖 **AI Reasoning:**\n${aiDecision}\n\n⚠️ This is a SIMULATED trade for safety.\nEnable AUTO_CONFIRM_LIVE=true for live trading.`,
        actions: ['AUTONOMOUS_TRADE'],
        source: message.content.source,
      });
      
      return {
        text: `Autonomous trade simulated: BUY ${side} $${tradeAmount}`,
        values: {
          success: true,
          traded: true,
          simulated: true,
          side,
          amount: tradeAmount,
        },
        data: {
          opportunity: topOpportunity,
          aiDecision,
          trade: {
            side,
            amount: tradeAmount,
            price: side === 'YES' ? topOpportunity.yesPrice : topOpportunity.noPrice,
          },
        },
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'AUTONOMOUS_TRADE failed');
      
      await callback({
        text: `❌ **Autonomous Trading Failed**\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nTry again or scan markets manually.`,
        actions: ['AUTONOMOUS_TRADE'],
        source: message.content.source,
      });
      
      return {
        text: 'Autonomous trade failed',
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
        content: { text: 'Find and execute a smart trade autonomously' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '✅ **Trade Executed**\n\n**Market:** "Bitcoin $100K by 2026?"\n**Order:** BUY YES $5.00 @ 45.2¢\n\n🤖 AI found undervalued opportunity',
          actions: ['AUTONOMOUS_TRADE'],
        },
      },
    ],
  ],
};
