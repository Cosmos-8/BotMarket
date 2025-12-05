/**
 * Polymarket API Client
 * 
 * Provides HTTP client functions for interacting with Polymarket's APIs:
 * - Gamma API: Market data and discovery
 * - CLOB API: Order submission and management
 * 
 * Supports both Gamma (testnet) and mainnet modes.
 */

import axios, { AxiosError } from 'axios';
import {
  PolymarketMarket,
  OrderSide,
  Outcome,
} from '@botmarket/shared';
import { SignedPolymarketOrder } from './polymarketSigning';
import { TradingMode, getTradingConfig } from './tradingConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Response from Polymarket CLOB order submission.
 */
export interface PolymarketOrderResponse {
  /** Order ID assigned by Polymarket */
  orderId: string;
  /** Order status */
  status: 'LIVE' | 'MATCHED' | 'CANCELED' | 'EXPIRED';
  /** Transaction hash if matched on-chain */
  transactionsHashes?: string[];
  /** Fill information if order was matched */
  fills?: {
    fillId: string;
    price: string;
    size: string;
    timestamp: string;
  }[];
  /** Error message if submission failed */
  errorMsg?: string;
}

/**
 * Error response from Polymarket API.
 */
export interface PolymarketApiError {
  error: string;
  message?: string;
  code?: string;
}

// ============================================================================
// Constants
// ============================================================================

const GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';
const CLOB_API = process.env.POLYMARKET_CLOB_API || 'https://clob.polymarket.com';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT = 15000;

/** Maximum retries for transient failures */
const MAX_RETRIES = 2;

// ============================================================================
// Console Colors
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// ============================================================================
// Market Data Functions (Gamma API)
// ============================================================================

/**
 * Get market data from Polymarket Gamma API
 */
export async function getMarketData(marketId: string): Promise<PolymarketMarket | null> {
  try {
    const response = await axios.get(`${GAMMA_API}/markets/${marketId}`, {
      timeout: REQUEST_TIMEOUT,
    });

    if (response.status === 200) {
      const data = response.data;
      
      // Parse outcomes and token IDs if they're strings
      let outcomes = data.outcomes;
      if (typeof outcomes === 'string') {
        try {
          outcomes = JSON.parse(outcomes);
        } catch {
          outcomes = outcomes.split(',');
        }
      }

      let clobTokenIds = data.clobTokenIds;
      if (typeof clobTokenIds === 'string') {
        try {
          clobTokenIds = JSON.parse(clobTokenIds);
        } catch {
          clobTokenIds = clobTokenIds.split(',');
        }
      }

      return {
        id: data.id,
        conditionId: data.conditionId,
        clobTokenIds,
        outcomes,
        title: data.title,
        active: data.active,
        volume: data.volume || 0,
        endDate: data.endDate,
      };
    }

    return null;
  } catch (error: any) {
    console.error(`Error fetching market ${marketId}:`, error.message);
    return null;
  }
}

/**
 * Get token ID for a specific outcome
 */
export function getTokenIdForOutcome(
  market: PolymarketMarket,
  outcome: Outcome
): string | null {
  const outcomeUpper = outcome.toUpperCase();
  const outcomeIndex = market.outcomes.findIndex(
    (o) => o.toUpperCase() === outcomeUpper
  );

  if (outcomeIndex === -1) {
    // Try alternative mappings
    if (outcomeUpper === 'YES' || outcomeUpper === 'UP') {
      const yesIndex = market.outcomes.findIndex(
        (o) => o.toUpperCase() === 'YES' || o.toUpperCase() === 'UP'
      );
      if (yesIndex !== -1 && yesIndex < market.clobTokenIds.length) {
        return market.clobTokenIds[yesIndex];
      }
    } else if (outcomeUpper === 'NO' || outcomeUpper === 'DOWN') {
      const noIndex = market.outcomes.findIndex(
        (o) => o.toUpperCase() === 'NO' || o.toUpperCase() === 'DOWN'
      );
      if (noIndex !== -1 && noIndex < market.clobTokenIds.length) {
        return market.clobTokenIds[noIndex];
      }
    }
    return null;
  }

  if (outcomeIndex >= market.clobTokenIds.length) {
    return null;
  }

  return market.clobTokenIds[outcomeIndex];
}

// ============================================================================
// Order Submission Functions (CLOB API)
// ============================================================================

/**
 * Submit a signed order to Polymarket CLOB API.
 * 
 * This function handles:
 * - HTTP errors and retries
 * - Non-200 responses
 * - Timeouts
 * - Invalid response bodies
 * 
 * @param order - The signed order to submit
 * @param mode - Trading mode ('gamma' or 'mainnet')
 * @returns Order response with ID, status, and any fill information
 */
export async function submitOrderToPolymarket(
  order: SignedPolymarketOrder,
  mode: TradingMode
): Promise<PolymarketOrderResponse> {
  if (mode === 'mock') {
    throw new Error('Cannot submit orders in mock mode');
  }
  
  const config = getTradingConfig();
  const baseUrl = config.clobApiUrl;
  const endpoint = `${baseUrl}/order`;
  
  console.log(`${COLORS.cyan}📤 Submitting order to Polymarket (${mode})...${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Endpoint:${COLORS.reset} ${endpoint}`);
  console.log(`${COLORS.cyan}   Token ID:${COLORS.reset} ${order.tokenId}`);
  console.log(`${COLORS.cyan}   Side:${COLORS.reset} ${order.side === '0' ? 'BUY' : 'SELL'}`);
  console.log(`${COLORS.cyan}   Maker:${COLORS.reset} ${order.maker}`);
  
  // Prepare the request payload
  const payload = {
    order: {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: parseInt(order.side),
      signatureType: parseInt(order.signatureType),
      signature: order.signature,
    },
    // Owner is the maker address
    owner: order.maker,
    // Order type: GTC (Good Till Cancelled)
    orderType: 'GTC',
  };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(endpoint, payload, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Check for successful response
      if (response.status >= 200 && response.status < 300) {
        const data = response.data;
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response body from Polymarket API');
        }
        
        const orderId = data.orderID || data.orderId || data.id;
        if (!orderId) {
          // Check for error in response
          if (data.error || data.errorMsg) {
            throw new Error(data.error || data.errorMsg);
          }
          throw new Error('No order ID in response');
        }
        
        console.log(`${COLORS.green}✅ Order submitted successfully${COLORS.reset}`);
        console.log(`${COLORS.cyan}   Order ID:${COLORS.reset} ${orderId}`);
        console.log(`${COLORS.cyan}   Status:${COLORS.reset} ${data.status || 'LIVE'}`);
        
        return {
          orderId,
          status: data.status || 'LIVE',
          transactionsHashes: data.transactionsHashes,
          fills: data.fills,
        };
      }
      
      // Non-2xx response
      throw new Error(`Polymarket API returned status ${response.status}`);
      
    } catch (error: any) {
      lastError = error;
      
      // Handle Axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<PolymarketApiError>;
        
        // Timeout
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          console.log(`${COLORS.yellow}⚠️  Request timeout (attempt ${attempt + 1}/${MAX_RETRIES + 1})${COLORS.reset}`);
          if (attempt < MAX_RETRIES) {
            await sleep(1000 * (attempt + 1)); // Exponential backoff
            continue;
          }
          throw new Error(`Request timeout after ${MAX_RETRIES + 1} attempts`);
        }
        
        // Server error (5xx) - retry
        if (axiosError.response?.status && axiosError.response.status >= 500) {
          console.log(`${COLORS.yellow}⚠️  Server error ${axiosError.response.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1})${COLORS.reset}`);
          if (attempt < MAX_RETRIES) {
            await sleep(1000 * (attempt + 1));
            continue;
          }
        }
        
        // Client error (4xx) - don't retry
        if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
          const errorData = axiosError.response.data;
          const errorMessage = errorData?.error || errorData?.message || `API error ${axiosError.response.status}`;
          console.log(`${COLORS.red}❌ Order submission failed: ${errorMessage}${COLORS.reset}`);
    
    return {
            orderId: '',
            status: 'CANCELED',
            errorMsg: errorMessage,
          };
        }
        
        // Network error
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          console.log(`${COLORS.red}❌ Network error: Cannot reach Polymarket API${COLORS.reset}`);
          throw new Error('Cannot reach Polymarket API - check network connection');
        }
      }
      
      // Unknown error - don't retry
      console.log(`${COLORS.red}❌ Order submission error: ${error.message}${COLORS.reset}`);
      throw error;
    }
  }
  
  throw lastError || new Error('Order submission failed');
}

/**
 * Get order status from Polymarket.
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  try {
    const response = await axios.get(`${CLOB_API}/order/${orderId}`, {
      timeout: REQUEST_TIMEOUT,
    });
    return response.data;
  } catch (error: any) {
    console.error(`Error getting order status ${orderId}:`, error.message);
    return null;
  }
}

/**
 * Cancel an order on Polymarket.
 * Note: This requires proper authentication which may need to be implemented.
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    const response = await axios.delete(`${CLOB_API}/order/${orderId}`, {
      timeout: REQUEST_TIMEOUT,
    });
    return response.status === 200;
  } catch (error: any) {
    console.error(`Error canceling order ${orderId}:`, error.message);
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the Polymarket API is reachable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${GAMMA_API}/markets`, {
      timeout: 5000,
      params: { limit: 1 },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
