import axios from 'axios';
import { ethers } from 'ethers';
import {
  PolymarketMarket,
  PolymarketOrder,
  OrderSide,
  Outcome,
} from '@botmarket/shared';

const GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';
const CLOB_API = process.env.POLYMARKET_CLOB_API || 'https://clob.polymarket.com';

/**
 * Get market data from Polymarket Gamma API
 */
export async function getMarketData(marketId: string): Promise<PolymarketMarket | null> {
  try {
    const response = await axios.get(`${GAMMA_API}/markets/${marketId}`, {
      timeout: 10000,
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

/**
 * Create and sign a Polymarket order
 * TODO: Implement full EIP-712 signing based on existing Python bot patterns
 */
export async function createOrder(
  tokenId: string,
  side: OrderSide,
  price: number,
  size: number,
  privateKey: string
): Promise<PolymarketOrder | null> {
  try {
    // This is a simplified version
    // Full implementation should use EIP-712 signing like the Python bot
    // See: https://docs.polymarket.com/clob-on-chain
    
    const nonce = Date.now();
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours

    // TODO: Implement proper order signing
    // For MVP, we'll structure the order but actual signing requires:
    // 1. EIP-712 domain and types
    // 2. Order message signing
    // 3. API key derivation (L1 signature)
    
    return {
      tokenId,
      side,
      price: price.toString(),
      size: size.toString(),
      nonce,
      expiration,
    };
  } catch (error: any) {
    console.error('Error creating order:', error);
    return null;
  }
}

/**
 * Submit order to Polymarket CLOB API
 * TODO: Implement full API integration with authentication
 */
export async function submitOrder(
  order: PolymarketOrder,
  apiKey: string,
  apiSecret: string,
  apiPassphrase: string
): Promise<string | null> {
  try {
    // TODO: Implement full CLOB API integration
    // This requires:
    // 1. API authentication (signature-based)
    // 2. Proper headers (POLY_ADDRESS, etc.)
    // 3. Order submission endpoint
    
    console.log('Order submission not fully implemented - requires API credentials');
    return null;
  } catch (error: any) {
    console.error('Error submitting order:', error);
    return null;
  }
}

/**
 * Get order status from Polymarket
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  try {
    // TODO: Implement order status checking
    const response = await axios.get(`${CLOB_API}/orders/${orderId}`, {
      timeout: 10000,
    });
    return response.data;
  } catch (error: any) {
    console.error(`Error getting order status ${orderId}:`, error);
    return null;
  }
}

