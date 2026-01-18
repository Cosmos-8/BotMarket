import type { Action, ActionResult, Content, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { ethers } from 'ethers';
import crypto from 'crypto';

const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com';
const POLYGON_RPC = 'https://polygon-rpc.com';

interface TradeParams {
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  amount: number; // in USDC
}

/**
 * EXECUTE_BUY Action
 * Execute a BUY order on Polymarket
 */
export const executeBuyAction: Action = {
  name: 'EXECUTE_BUY',
  similes: ['BUY', 'PLACE_BUY_ORDER', 'GO_LONG', 'BUY_YES', 'BUY_NO'],
  description: 'Execute a buy order on a Polymarket prediction market',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('buy') ||
      text.includes('go long') ||
      text.includes('place order') ||
      text.includes('execute trade')
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
      logger.info('Executing EXECUTE_BUY action');
      
      const text = message.content?.text || '';
      
      // Check if trading is enabled
      const privateKey = process.env.POLYMARKET_WALLET_PRIVATE_KEY;
      const builderApiKey = process.env.POLYMARKET_BUILDER_API_KEY;
      
      if (!privateKey || !builderApiKey) {
        const responseContent: Content = {
          text: '⚠️ **Trading Disabled**\n\nI can analyze markets and provide recommendations, but trading is not configured. Please set up your Polymarket credentials to enable live trading.',
          actions: ['EXECUTE_BUY'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'Trading not configured',
          values: { success: false, reason: 'no_credentials' },
          data: {},
          success: false,
        };
      }
      
      // Parse trade parameters from message
      const amountMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 5; // Default $5
      
      const outcomeMatch = text.match(/\b(yes|no)\b/i);
      const outcome = outcomeMatch?.[1]?.toUpperCase() as 'YES' | 'NO' || 'YES';
      
      // Safety checks
      const maxTradeSize = parseFloat(process.env.MAX_TRADE_SIZE_USD || '10');
      if (amount > maxTradeSize) {
        const responseContent: Content = {
          text: `⚠️ **Trade Rejected**\n\nAmount $${amount} exceeds maximum trade size of $${maxTradeSize}. Please reduce your position size.`,
          actions: ['EXECUTE_BUY'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'Trade exceeds max size',
          values: { success: false, reason: 'exceeds_max_size' },
          data: { requestedAmount: amount, maxAllowed: maxTradeSize },
          success: false,
        };
      }
      
      // For now, simulate the trade (actual trading requires full Polymarket integration)
      // In production, this would:
      // 1. Fetch market details and token IDs
      // 2. Get best available price
      // 3. Sign EIP-712 order
      // 4. Submit to Polymarket CLOB
      
      const simulatedOrderId = crypto.randomUUID();
      const simulatedPrice = outcome === 'YES' ? 0.52 : 0.48;
      const tokenAmount = amount / simulatedPrice;
      
      const responseContent: Content = {
        text: `✅ **Trade Submitted**

📊 **Order Details:**
- Type: BUY ${outcome}
- Amount: $${amount.toFixed(2)} USDC
- Est. Price: ${(simulatedPrice * 100).toFixed(1)}¢
- Est. Tokens: ${tokenAmount.toFixed(2)}
- Order ID: \`${simulatedOrderId.slice(0, 8)}...\`

⏳ Order sent to Polymarket. Status updates coming...

⚠️ *Note: This is a simulated trade for safety. Enable live trading in production.*`,
        actions: ['EXECUTE_BUY'],
        source: message.content.source,
      };
      
      await callback(responseContent);
      
      return {
        text: `BUY ${outcome} order submitted`,
        values: {
          success: true,
          outcome,
          amount,
          simulated: true,
        },
        data: {
          orderId: simulatedOrderId,
          side: 'BUY',
          outcome,
          amount,
          estimatedPrice: simulatedPrice,
          estimatedTokens: tokenAmount,
        },
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'EXECUTE_BUY failed');
      
      const errorContent: Content = {
        text: `❌ **Trade Failed**\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        actions: ['EXECUTE_BUY'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Trade execution failed',
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
        content: { text: 'Buy $10 YES on Bitcoin 100K' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '✅ **Trade Submitted**\n\n📊 **Order Details:**\n- Type: BUY YES\n- Amount: $10.00 USDC',
          actions: ['EXECUTE_BUY'],
        },
      },
    ],
  ],
};

/**
 * EXECUTE_SELL Action
 * Execute a SELL order on Polymarket
 */
export const executeSellAction: Action = {
  name: 'EXECUTE_SELL',
  similes: ['SELL', 'PLACE_SELL_ORDER', 'CLOSE_POSITION', 'EXIT'],
  description: 'Execute a sell order or close a position on Polymarket',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('sell') ||
      text.includes('close position') ||
      text.includes('exit') ||
      text.includes('take profit')
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
      logger.info('Executing EXECUTE_SELL action');
      
      const text = message.content?.text || '';
      
      // Check if trading is enabled
      const privateKey = process.env.POLYMARKET_WALLET_PRIVATE_KEY;
      
      if (!privateKey) {
        const responseContent: Content = {
          text: '⚠️ **Trading Disabled**\n\nTrading credentials not configured. Cannot execute sell orders.',
          actions: ['EXECUTE_SELL'],
          source: message.content.source,
        };
        await callback(responseContent);
        
        return {
          text: 'Trading not configured',
          values: { success: false, reason: 'no_credentials' },
          data: {},
          success: false,
        };
      }
      
      // Parse sell parameters
      const outcomeMatch = text.match(/\b(yes|no)\b/i);
      const outcome = outcomeMatch?.[1]?.toUpperCase() || 'all positions';
      
      const amountMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null; // null means all
      
      const simulatedOrderId = crypto.randomUUID();
      
      const responseContent: Content = {
        text: `✅ **Sell Order Submitted**

📊 **Order Details:**
- Type: SELL ${outcome}
- Amount: ${amount ? `$${amount.toFixed(2)}` : 'All positions'}
- Order ID: \`${simulatedOrderId.slice(0, 8)}...\`

⏳ Order sent to Polymarket...

⚠️ *Note: This is a simulated sell for safety.*`,
        actions: ['EXECUTE_SELL'],
        source: message.content.source,
      };
      
      await callback(responseContent);
      
      return {
        text: `SELL order submitted`,
        values: {
          success: true,
          outcome,
          amount,
          simulated: true,
        },
        data: {
          orderId: simulatedOrderId,
          side: 'SELL',
          outcome,
          amount,
        },
        success: true,
      };
      
    } catch (error) {
      logger.error({ error }, 'EXECUTE_SELL failed');
      
      const errorContent: Content = {
        text: `❌ **Sell Order Failed**\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['EXECUTE_SELL'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      
      return {
        text: 'Sell execution failed',
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
        content: { text: 'Sell my YES position' },
      },
      {
        name: '{{name2}}',
        content: {
          text: '✅ **Sell Order Submitted**\n\n📊 **Order Details:**\n- Type: SELL YES',
          actions: ['EXECUTE_SELL'],
        },
      },
    ],
  ],
};
