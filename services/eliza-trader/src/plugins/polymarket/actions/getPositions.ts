import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';

/**
 * GET_POSITIONS Action
 * Retrieve and display current Polymarket positions
 */
export const getPositionsAction: Action = {
  name: 'GET_POSITIONS',
  similes: ['MY_POSITIONS', 'SHOW_POSITIONS', 'PORTFOLIO', 'HOLDINGS', 'WHAT_DO_I_OWN'],
  description: 'Get current Polymarket positions and portfolio summary',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('position') ||
      text.includes('portfolio') ||
      text.includes('holdings') ||
      text.includes('what do i own') ||
      text.includes('my trades') ||
      text.includes('balance')
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
      logger.info('Executing GET_POSITIONS action');
      
      const walletAddress = process.env.POLYMARKET_WALLET_ADDRESS;
      
      if (!walletAddress) {
        const responseContent: Content = {
          text: '⚠️ **No Wallet Connected**\n\nPlease configure your Polymarket wallet address to view positions.',
          actions: ['GET_POSITIONS'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'No wallet configured',
          values: { success: false, reason: 'no_wallet' },
          data: {},
          success: false,
        };
      }
      
      // Fetch positions from Polymarket
      // In production, this would query the CLOB API for the wallet's positions
      try {
        const response = await fetch(
          `https://clob.polymarket.com/data/positions?user=${walletAddress}`
        );
        
        if (response.ok) {
          const positions = await response.json();
          
          if (!positions || positions.length === 0) {
            const responseContent: Content = {
              text: '📊 **Your Portfolio**\n\n*No open positions*\n\nStart trading by asking me to scan markets or analyze opportunities!',
              actions: ['GET_POSITIONS'],
              source: message.content.source,
            };
            await callback(responseContent);
            
            return {
              text: 'No positions found',
              values: { success: true, positionCount: 0 },
              data: { positions: [] },
              success: true,
            };
          }
          
          // Format positions
          const positionSummaries = positions.map((p: any, i: number) => {
            const pnl = ((p.currentPrice - p.avgPrice) / p.avgPrice * 100).toFixed(1);
            const pnlEmoji = parseFloat(pnl) >= 0 ? '🟢' : '🔴';
            return `${i + 1}. **${p.marketQuestion || 'Unknown Market'}**
   ${p.outcome}: ${p.quantity} tokens @ ${(p.avgPrice * 100).toFixed(1)}¢
   Current: ${(p.currentPrice * 100).toFixed(1)}¢ | P&L: ${pnlEmoji} ${pnl}%`;
          }).join('\n\n');
          
          const totalValue = positions.reduce((sum: number, p: any) => 
            sum + (p.quantity * p.currentPrice), 0);
          
          const responseContent: Content = {
            text: `📊 **Your Portfolio**

${positionSummaries}

━━━━━━━━━━━━━━━
💰 **Total Value:** $${totalValue.toFixed(2)}
📈 **Positions:** ${positions.length}`,
            actions: ['GET_POSITIONS'],
            source: message.content.source,
          };
          await callback(responseContent);
          
          return {
            text: `Retrieved ${positions.length} positions`,
            values: { success: true, positionCount: positions.length },
            data: { positions, totalValue },
            success: true,
          };
        }
      } catch (apiError) {
        logger.warn({ error: apiError }, 'Could not fetch positions from API');
      }
      
      // Fallback: Show demo positions
      const responseContent: Content = {
        text: `📊 **Your Portfolio**

*Unable to fetch live positions. Showing demo data:*

1. **Bitcoin to reach $100K?**
   YES: 50 tokens @ 52.0¢
   Current: 58.5¢ | P&L: 🟢 +12.5%

2. **ETH ETF approved 2026?**
   NO: 30 tokens @ 35.0¢
   Current: 32.0¢ | P&L: 🔴 -8.6%

━━━━━━━━━━━━━━━
💰 **Total Value:** $38.85
📈 **Positions:** 2

*Configure API credentials for live data*`,
        actions: ['GET_POSITIONS'],
        source: message.content.source,
      };
      await callback(responseContent);
      
      return {
        text: 'Showed demo positions',
        values: { success: true, demo: true },
        data: {},
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'GET_POSITIONS failed');
      
      const errorContent: Content = {
        text: `❌ **Failed to get positions**\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['GET_POSITIONS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Failed to get positions',
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
        content: { text: 'Show me my positions' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 **Your Portfolio**\n\n1. **Bitcoin to reach $100K?**\n   YES: 50 tokens @ 52.0¢',
          actions: ['GET_POSITIONS'],
        },
      },
    ],
  ],
};
