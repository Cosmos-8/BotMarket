/**
 * Mock Execution Module
 * 
 * Provides simulated order execution for demo/testing purposes.
 * When ENABLE_LIVE_TRADING is false (default), all trades are mocked
 * with realistic but fake data stored in the database.
 * 
 * This allows the hackathon demo to show the full trading flow
 * without requiring real Polymarket API credentials or real money.
 */

import { prisma } from './prisma';
import { OrderSide, Outcome, ORDER_STATUS } from '@botmarket/shared';

// ============================================================================
// Types
// ============================================================================

export interface MockMarketInfo {
  marketId: string;
  marketSlug: string;
  currency: string;
  timeframe: string;
}

export interface MockExecutionResult {
  orderId: string;
  fillId: string;
  status: 'FILLED';
  sizeUsd: number;
  price: number;
  feesUsd: number;
  filledAt: Date;
}

export interface MockOrderParams {
  botId: string;           // Internal bot ID (bot.id from Prisma)
  botIdExternal: string;   // External bot ID (bot.botId)
  side: OrderSide;
  outcome: Outcome;
  sizeUsd: number;
  marketInfo: MockMarketInfo;
}

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Generate a realistic mock price for prediction market outcomes.
 * Prices cluster around 0.45-0.65 range which is typical for active markets.
 */
export function generateMockPrice(): number {
  // Base price around 0.50-0.55
  const base = 0.50 + Math.random() * 0.05;
  // Add some variance ±0.10
  const variance = (Math.random() - 0.5) * 0.20;
  // Clamp to realistic range [0.35, 0.75]
  return Math.max(0.35, Math.min(0.75, base + variance));
}

/**
 * Generate a mock order ID that looks like a real Polymarket order ID.
 */
export function generateMockOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `mock_${timestamp}_${random}`;
}

/**
 * Generate a mock fill ID.
 */
export function generateMockFillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `fill_${timestamp}_${random}`;
}

/**
 * Generate a mock token ID for the outcome.
 */
export function generateMockTokenId(marketId: string, outcome: Outcome): string {
  // Create a deterministic-looking token ID based on market and outcome
  const outcomeNum = outcome === 'YES' ? '0' : '1';
  return `${marketId.substring(0, 8)}_token_${outcomeNum}`;
}

/**
 * Calculate mock fees (typically 0-2% of trade value).
 */
export function calculateMockFees(sizeUsd: number): number {
  // Random fee between 0.1% and 1.5%
  const feeRate = 0.001 + Math.random() * 0.014;
  return Math.round(sizeUsd * feeRate * 100) / 100;
}

// ============================================================================
// Console Logging with Colors
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logMockOrder(params: MockOrderParams, price: number): void {
  const { side, outcome, sizeUsd, marketInfo, botIdExternal } = params;
  
  console.log('');
  console.log(`${COLORS.bright}${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.magenta}🎯 MOCK ORDER${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Action:${COLORS.reset}  ${COLORS.bright}${side} ${outcome}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}     ${botIdExternal.substring(0, 20)}...`);
  console.log(`${COLORS.cyan}   Market:${COLORS.reset}  ${marketInfo.currency} ${marketInfo.timeframe}`);
  console.log(`${COLORS.cyan}   Size:${COLORS.reset}    ${COLORS.green}$${sizeUsd.toFixed(2)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Price:${COLORS.reset}   ${price.toFixed(4)}`);
  console.log(`${COLORS.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
}

function logMockFill(result: MockExecutionResult, dbOrderId: string): void {
  console.log(`${COLORS.bright}${COLORS.green}✅ MOCK FILL STORED${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Order ID:${COLORS.reset} ${dbOrderId}`);
  console.log(`${COLORS.cyan}   Fill ID:${COLORS.reset}  ${result.fillId}`);
  console.log(`${COLORS.cyan}   Price:${COLORS.reset}    ${result.price.toFixed(4)}`);
  console.log(`${COLORS.cyan}   Size:${COLORS.reset}     ${COLORS.green}$${result.sizeUsd.toFixed(2)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Fees:${COLORS.reset}     $${result.feesUsd.toFixed(2)}`);
  console.log(`${COLORS.cyan}   Time:${COLORS.reset}     ${result.filledAt.toISOString()}`);
  console.log('');
}

// ============================================================================
// Main Mock Execution Function
// ============================================================================

/**
 * Execute a mock order for demo purposes.
 * 
 * This function:
 * 1. Generates realistic mock price, fees, and IDs
 * 2. Creates an Order record in the database with status FILLED
 * 3. Creates a corresponding Fill record
 * 4. Logs colorful output to the console for demo visibility
 * 
 * @param params - Mock order parameters
 * @returns MockExecutionResult with order details
 */
export async function mockExecuteOrder(
  params: MockOrderParams
): Promise<MockExecutionResult> {
  const { botId, botIdExternal, side, outcome, sizeUsd, marketInfo } = params;

  // Generate mock values
  const price = generateMockPrice();
  const feesUsd = calculateMockFees(sizeUsd);
  const mockOrderId = generateMockOrderId();
  const mockFillId = generateMockFillId();
  const mockTokenId = generateMockTokenId(marketInfo.marketId, outcome);
  const filledAt = new Date();

  // Log the mock order
  logMockOrder(params, price);

  // Create Order in database with FILLED status
  const dbOrder = await prisma.order.create({
    data: {
      botId: botIdExternal,  // Use external bot ID to match schema relation
      marketId: marketInfo.marketId,
      outcome,
      side,
      price,
      size: sizeUsd,
      status: ORDER_STATUS.FILLED,
      orderId: mockOrderId,
      tokenId: mockTokenId,
    },
  });

  // Create Fill in database
  const dbFill = await prisma.fill.create({
    data: {
      botId: botIdExternal,  // Use external bot ID to match schema relation
      orderId: dbOrder.id,
      price,
      size: sizeUsd,
      fees: feesUsd,
      fillId: mockFillId,
    },
  });

  const result: MockExecutionResult = {
    orderId: mockOrderId,
    fillId: mockFillId,
    status: 'FILLED',
    sizeUsd,
    price,
    feesUsd,
    filledAt,
  };

  // Log the fill
  logMockFill(result, dbOrder.id);

  return result;
}

/**
 * Check if we should use mock execution mode.
 * Default is true (mock mode) unless ENABLE_LIVE_TRADING is explicitly 'true'.
 */
export function isMockMode(): boolean {
  const enableLive = process.env.ENABLE_LIVE_TRADING;
  return enableLive !== 'true';
}

/**
 * Log the current trading mode on startup.
 */
export function logTradingMode(): void {
  const mockMode = isMockMode();
  
  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}╔════════════════════════════════════════════════════════╗${COLORS.reset}`);
  if (mockMode) {
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.yellow}⚠️  MOCK TRADING MODE${COLORS.reset}                               ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  Orders will be simulated, not sent to Polymarket     ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  Set ENABLE_LIVE_TRADING=true for real trading        ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
  } else {
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.green}🔴 LIVE TRADING MODE${COLORS.reset}                                ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.bright}${COLORS.magenta}WARNING: Real orders will be placed!${COLORS.reset}               ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
  }
  console.log(`${COLORS.bright}${COLORS.blue}╚════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log('');
}

