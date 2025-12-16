/**
 * Safety Verification Module
 * 
 * Provides comprehensive safety checks before enabling live trading:
 * - Environment variable validation
 * - Wallet balance diagnostics (USDC and MATIC on Polygon)
 * - Dry-run EIP-712 signing test
 * - Kill-switch logic for trade execution
 * - Manual confirmation prompt for live modes
 * 
 * This module ensures that the worker never accidentally executes
 * live trades without proper setup and explicit user confirmation.
 */

import { ethers } from 'ethers';
import { TradingConfig, TradingMode } from './tradingConfig';
import { signPolymarketOrder, OrderSide as PolymarketOrderSide, getWalletAddress } from './polymarketSigning';
import { prisma } from './prisma';
import * as readline from 'readline';

// ============================================================================
// Console Colors
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
};

// ============================================================================
// Types
// ============================================================================

export interface WalletDiagnostics {
  address: string;
  usdcBalance: number;
  maticBalance: number;
  usdcSufficient: boolean;
  maticSufficient: boolean;
  checksumAddress: string;
}

export interface SafetyVerificationResult {
  passed: boolean;
  envValid: boolean;
  walletDiagnostics: WalletDiagnostics | null;
  signingTestPassed: boolean;
  errors: string[];
  warnings: string[];
  forceMockMode: boolean;
}

export interface KillSwitchResult {
  allowed: boolean;
  reason?: string;
  killSwitch?: string;
}

export interface RequiredEnvVars {
  POLYMARKET_PRIVATE_KEY: string | undefined;
  POLYMARKET_WALLET_ADDRESS: string | undefined;
  MAX_TRADE_SIZE_USD: string | undefined;
  MAX_DAILY_NOTIONAL_USD: string | undefined;
  TRADING_MODE: string | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Polygon RPC endpoint for balance checks */
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

/** USDC contract address on Polygon */
// Native USDC on Polygon (not USDC.e bridged version)
const USDC_ADDRESS_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

/** Minimum MATIC balance required for gas */
const MIN_MATIC_BALANCE = 0.01;

/** Confirmation code required for live trading */
const LIVE_CONFIRM_CODE = 'LIVE_CONFIRM';

// ERC20 ABI for balance check
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ============================================================================
// Environment Validation
// ============================================================================

/**
 * Get all required environment variables for live trading.
 */
export function getRequiredEnvVars(): RequiredEnvVars {
  return {
    POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,
    POLYMARKET_WALLET_ADDRESS: process.env.POLYMARKET_WALLET_ADDRESS,
    MAX_TRADE_SIZE_USD: process.env.MAX_TRADE_SIZE_USD,
    MAX_DAILY_NOTIONAL_USD: process.env.MAX_DAILY_NOTIONAL_USD,
    TRADING_MODE: process.env.TRADING_MODE,
  };
}

/**
 * Validate that all required environment variables are set for live trading.
 * Returns array of missing/invalid variable names.
 */
export function validateEnvVariables(config: TradingConfig): string[] {
  const errors: string[] = [];
  const envVars = getRequiredEnvVars();

  // TRADING_MODE is always required
  if (!envVars.TRADING_MODE) {
    errors.push('TRADING_MODE is not set (defaults to "mock")');
  }

  // For live modes, additional vars are required
  if (config.mode !== 'mock') {
    if (!envVars.POLYMARKET_PRIVATE_KEY) {
      errors.push('POLYMARKET_PRIVATE_KEY is required for live trading');
    } else if (envVars.POLYMARKET_PRIVATE_KEY.length < 64) {
      errors.push('POLYMARKET_PRIVATE_KEY appears invalid (too short)');
    }

    if (!envVars.POLYMARKET_WALLET_ADDRESS) {
      errors.push('POLYMARKET_WALLET_ADDRESS is required for live trading');
    } else if (!ethers.isAddress(envVars.POLYMARKET_WALLET_ADDRESS)) {
      errors.push('POLYMARKET_WALLET_ADDRESS is not a valid Ethereum address');
    }

    // Validate private key matches wallet address
    if (envVars.POLYMARKET_PRIVATE_KEY && envVars.POLYMARKET_WALLET_ADDRESS) {
      try {
        const derivedAddress = getWalletAddress(envVars.POLYMARKET_PRIVATE_KEY);
        if (derivedAddress.toLowerCase() !== envVars.POLYMARKET_WALLET_ADDRESS.toLowerCase()) {
          errors.push(`POLYMARKET_WALLET_ADDRESS does not match derived address from private key. Expected: ${derivedAddress}`);
        }
      } catch (e: any) {
        errors.push(`Invalid POLYMARKET_PRIVATE_KEY: ${e.message}`);
      }
    }

    // MAX_TRADE_SIZE_USD - warn if not set (uses default)
    if (!envVars.MAX_TRADE_SIZE_USD) {
      errors.push('MAX_TRADE_SIZE_USD is not set (using default $1)');
    }

    // MAX_DAILY_NOTIONAL_USD - warn if not set (uses default)
    if (!envVars.MAX_DAILY_NOTIONAL_USD) {
      errors.push('MAX_DAILY_NOTIONAL_USD is not set (using default $10)');
    }
  }

  return errors;
}

// ============================================================================
// Wallet Diagnostics
// ============================================================================

/**
 * Fetch wallet balances from Polygon mainnet.
 * Returns USDC and MATIC balances.
 */
export async function fetchWalletBalances(
  walletAddress: string,
  maxTradeSizeUsd: number
): Promise<WalletDiagnostics> {
  const checksumAddress = ethers.getAddress(walletAddress);
  
  let usdcBalance = 0;
  let maticBalance = 0;

  try {
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);

    // Fetch MATIC balance
    const maticBalanceWei = await provider.getBalance(checksumAddress);
    maticBalance = parseFloat(ethers.formatEther(maticBalanceWei));

    // Fetch USDC balance
    const usdcContract = new ethers.Contract(USDC_ADDRESS_POLYGON, ERC20_ABI, provider);
    const usdcBalanceRaw = await usdcContract.balanceOf(checksumAddress);
    const usdcDecimals = await usdcContract.decimals();
    usdcBalance = parseFloat(ethers.formatUnits(usdcBalanceRaw, usdcDecimals));

  } catch (error: any) {
    console.log(`${COLORS.yellow}⚠️  Could not fetch wallet balances: ${error.message}${COLORS.reset}`);
    console.log(`${COLORS.dim}   Using Polygon RPC: ${POLYGON_RPC_URL}${COLORS.reset}`);
  }

  return {
    address: walletAddress,
    checksumAddress,
    usdcBalance,
    maticBalance,
    usdcSufficient: usdcBalance >= maxTradeSizeUsd,
    maticSufficient: maticBalance >= MIN_MATIC_BALANCE,
  };
}

// ============================================================================
// Dry-Run Signing Test
// ============================================================================

/**
 * Perform a dry-run EIP-712 signing test.
 * Creates a fake order and signs it WITHOUT submitting.
 * Returns true if signing succeeds.
 */
export async function performDryRunSigningTest(privateKey: string): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Create a fake order for testing signing
    const fakeOrderInput = {
      tokenId: '1234567890',
      side: PolymarketOrderSide.BUY,
      price: 50, // 50 cents
      size: '1000000', // 1 token in smallest units
      feeRateBps: 0,
      nonce: Date.now(),
      expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    console.log(`${COLORS.cyan}🔐 Performing dry-run EIP-712 signing test...${COLORS.reset}`);
    
    const signedOrder = await signPolymarketOrder(fakeOrderInput, privateKey);
    
    console.log(`${COLORS.green}✅ Dry-run signing test PASSED${COLORS.reset}`);
    console.log(`${COLORS.dim}   Signature: ${signedOrder.signature.substring(0, 20)}...${COLORS.reset}`);
    console.log(`${COLORS.dim}   (Order NOT transmitted - this was a test only)${COLORS.reset}`);

    return {
      success: true,
      signature: signedOrder.signature,
    };
  } catch (error: any) {
    console.log(`${COLORS.red}❌ Dry-run signing test FAILED: ${error.message}${COLORS.reset}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Kill-Switch Logic
// ============================================================================

/**
 * Check all kill-switches before allowing a trade.
 * Returns whether the trade is allowed and which kill-switch triggered if not.
 */
export async function checkKillSwitches(
  botId: string,
  tradeSizeUsd: number,
  config: TradingConfig,
  walletDiagnostics: WalletDiagnostics | null
): Promise<KillSwitchResult> {
  
  // Kill-switch 1: Trade size exceeds max
  if (tradeSizeUsd > config.maxTradeSizeUsd) {
    return {
      allowed: false,
      reason: `Trade size $${tradeSizeUsd.toFixed(2)} exceeds MAX_TRADE_SIZE_USD ($${config.maxTradeSizeUsd.toFixed(2)})`,
      killSwitch: 'MAX_TRADE_SIZE_USD',
    };
  }

  // Kill-switch 2: Daily notional exceeded
  const dailyNotional = await getDailyNotionalForBot(botId);
  if (dailyNotional + tradeSizeUsd > config.maxDailyNotionalUsd) {
    return {
      allowed: false,
      reason: `Daily notional would be $${(dailyNotional + tradeSizeUsd).toFixed(2)}, exceeds MAX_DAILY_NOTIONAL_USD ($${config.maxDailyNotionalUsd.toFixed(2)})`,
      killSwitch: 'MAX_DAILY_NOTIONAL_USD',
    };
  }

  // Kill-switch 3: Last 5 trades are losses
  const last5Trades = await getLastNTradesForBot(botId, 5);
  if (last5Trades.length >= 5) {
    const allLosses = last5Trades.every(trade => trade.pnl !== null && trade.pnl < 0);
    if (allLosses) {
      return {
        allowed: false,
        reason: 'Last 5 trades were all losses - trading paused for safety',
        killSwitch: 'CONSECUTIVE_LOSSES',
      };
    }
  }

  // Kill-switch 4: Wallet USDC insufficient
  if (walletDiagnostics && !walletDiagnostics.usdcSufficient) {
    return {
      allowed: false,
      reason: `Wallet USDC balance ($${walletDiagnostics.usdcBalance.toFixed(2)}) is less than trade size ($${tradeSizeUsd.toFixed(2)})`,
      killSwitch: 'INSUFFICIENT_USDC',
    };
  }

  // Kill-switch 5: Wallet MATIC insufficient for gas
  if (walletDiagnostics && !walletDiagnostics.maticSufficient) {
    return {
      allowed: false,
      reason: `Wallet MATIC balance (${walletDiagnostics.maticBalance.toFixed(4)}) is less than minimum (${MIN_MATIC_BALANCE}) for gas`,
      killSwitch: 'INSUFFICIENT_MATIC',
    };
  }

  return { allowed: true };
}

/**
 * Get daily notional traded by a bot.
 */
async function getDailyNotionalForBot(botId: string): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const orders = await prisma.order.findMany({
    where: {
      botId,
      placedAt: { gte: twentyFourHoursAgo },
    },
    select: { size: true },
  });
  
  return orders.reduce((sum, order) => sum + order.size, 0);
}

/**
 * Get last N trades for a bot with PnL info.
 */
async function getLastNTradesForBot(botId: string, n: number): Promise<{ pnl: number | null }[]> {
  const fills = await prisma.fill.findMany({
    where: { botId },
    orderBy: { fillAt: 'desc' },
    take: n,
    select: {
      price: true,
      size: true,
      fees: true,
    },
  });

  // For now, return null PnL since we don't have realized PnL tracking
  // In production, this would calculate actual PnL from entry/exit pairs
  return fills.map(() => ({ pnl: null }));
}

// ============================================================================
// Safety Confirmation Prompt
// ============================================================================

/**
 * Display a giant warning banner and prompt for confirmation.
 * Returns true only if user types LIVE_CONFIRM.
 * Set AUTO_CONFIRM_LIVE=true env var to skip confirmation (for testing).
 */
export async function promptForLiveConfirmation(
  config: TradingConfig,
  walletDiagnostics: WalletDiagnostics | null
): Promise<boolean> {
  // Auto-confirm for testing (use with caution!)
  if (process.env.AUTO_CONFIRM_LIVE === 'true') {
    console.log(`${COLORS.bgYellow}${COLORS.bright} ⚠️  AUTO_CONFIRM_LIVE=true - Skipping confirmation prompt ${COLORS.reset}`);
    console.log(`${COLORS.bgGreen}${COLORS.bright} ✓ LIVE TRADING AUTO-CONFIRMED ${COLORS.reset}`);
    return true;
  }

  return new Promise((resolve) => {
    console.log('');
    console.log(`${COLORS.bgRed}${COLORS.bright}                                                                    ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ██████╗  █████╗ ███╗   ██╗ ██████╗ ███████╗██████╗ ██╗            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔════╝██╔══██╗██║            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ██║  ██║███████║██╔██╗ ██║██║  ███╗█████╗  ██████╔╝██║            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ██║  ██║██╔══██║██║╚██╗██║██║   ██║██╔══╝  ██╔══██╗╚═╝            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ██████╔╝██║  ██║██║ ╚████║╚██████╔╝███████╗██║  ██║██╗            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝            ${COLORS.reset}`);
    console.log(`${COLORS.bgRed}${COLORS.bright}                                                                    ${COLORS.reset}`);
    console.log('');
    console.log(`${COLORS.bright}${COLORS.red}🚨 LIVE TRADING MODE REQUESTED: ${config.mode.toUpperCase()} 🚨${COLORS.reset}`);
    console.log('');
    console.log(`${COLORS.bright}${COLORS.yellow}This worker will execute REAL trades with REAL money!${COLORS.reset}`);
    console.log('');
    console.log(`${COLORS.cyan}╔════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset} ${COLORS.bright}CONFIGURATION SUMMARY${COLORS.reset}                                              ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}╠════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset}   Trading Mode:        ${COLORS.bright}${config.mode.toUpperCase()}${COLORS.reset}                                       ${COLORS.cyan}║${COLORS.reset}`);
    
    if (walletDiagnostics) {
      console.log(`${COLORS.cyan}║${COLORS.reset}   Wallet Address:      ${walletDiagnostics.checksumAddress.substring(0, 20)}...       ${COLORS.cyan}║${COLORS.reset}`);
      console.log(`${COLORS.cyan}║${COLORS.reset}   USDC Balance:        ${walletDiagnostics.usdcSufficient ? COLORS.green : COLORS.red}$${walletDiagnostics.usdcBalance.toFixed(2)}${COLORS.reset}                                        ${COLORS.cyan}║${COLORS.reset}`);
      console.log(`${COLORS.cyan}║${COLORS.reset}   MATIC Balance:       ${walletDiagnostics.maticSufficient ? COLORS.green : COLORS.red}${walletDiagnostics.maticBalance.toFixed(4)} MATIC${COLORS.reset}                                ${COLORS.cyan}║${COLORS.reset}`);
    } else {
      console.log(`${COLORS.cyan}║${COLORS.reset}   Wallet:              ${COLORS.yellow}Could not fetch balances${COLORS.reset}                       ${COLORS.cyan}║${COLORS.reset}`);
    }
    
    console.log(`${COLORS.cyan}╠════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset} ${COLORS.bright}SAFETY CAPS${COLORS.reset}                                                         ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}╠════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset}   Max Trade Size:      ${COLORS.bright}$${config.maxTradeSizeUsd.toFixed(2)}${COLORS.reset}                                          ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}║${COLORS.reset}   Max Daily Notional:  ${COLORS.bright}$${config.maxDailyNotionalUsd.toFixed(2)}${COLORS.reset}                                         ${COLORS.cyan}║${COLORS.reset}`);
    console.log(`${COLORS.cyan}╚════════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
    console.log('');
    console.log(`${COLORS.bright}${COLORS.yellow}To enable live trading, type: ${COLORS.green}${LIVE_CONFIRM_CODE}${COLORS.reset}`);
    console.log(`${COLORS.dim}(Or press Ctrl+C to exit, or type anything else to run in MOCK mode)${COLORS.reset}`);
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Set a timeout - if no input within 30 seconds, default to mock mode
    const timeout = setTimeout(() => {
      console.log('');
      console.log(`${COLORS.yellow}⏰ Timeout waiting for confirmation. Defaulting to MOCK mode.${COLORS.reset}`);
      rl.close();
      resolve(false);
    }, 30000);

    rl.question(`${COLORS.bright}> ${COLORS.reset}`, (answer) => {
      clearTimeout(timeout);
      rl.close();

      if (answer.trim() === LIVE_CONFIRM_CODE) {
        console.log('');
        console.log(`${COLORS.bgGreen}${COLORS.bright} ✓ LIVE TRADING CONFIRMED ${COLORS.reset}`);
        console.log('');
        resolve(true);
      } else {
        console.log('');
        console.log(`${COLORS.yellow}⚠️  Confirmation not provided. Defaulting to MOCK mode.${COLORS.reset}`);
        console.log('');
        resolve(false);
      }
    });
  });
}

// ============================================================================
// Main Safety Verification Function
// ============================================================================

/**
 * Perform full safety verification for live trading modes.
 * 
 * This function:
 * 1. Validates all required environment variables
 * 2. Fetches wallet balances from Polygon
 * 3. Performs dry-run signing test
 * 4. Determines if the worker should force-fallback to mock mode
 * 
 * @returns SafetyVerificationResult with all check results
 */
export async function performSafetyVerification(
  config: TradingConfig
): Promise<SafetyVerificationResult> {
  const result: SafetyVerificationResult = {
    passed: false,
    envValid: false,
    walletDiagnostics: null,
    signingTestPassed: false,
    errors: [],
    warnings: [],
    forceMockMode: false,
  };

  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}  SAFETY VERIFICATION - ${config.mode.toUpperCase()} MODE${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log('');

  // Step 1: Validate environment variables
  console.log(`${COLORS.cyan}📋 Step 1: Validating environment variables...${COLORS.reset}`);
  const envErrors = validateEnvVariables(config);
  
  if (envErrors.length === 0) {
    console.log(`${COLORS.green}   ✅ All required environment variables are set${COLORS.reset}`);
    result.envValid = true;
  } else {
    for (const error of envErrors) {
      if (error.includes('not set') && (error.includes('MAX_TRADE') || error.includes('MAX_DAILY'))) {
        console.log(`${COLORS.yellow}   ⚠️  ${error}${COLORS.reset}`);
        result.warnings.push(error);
      } else {
        console.log(`${COLORS.red}   ❌ ${error}${COLORS.reset}`);
        result.errors.push(error);
      }
    }
    
    if (result.errors.length > 0) {
      result.forceMockMode = true;
    }
  }
  console.log('');

  // Step 2: Wallet diagnostics (only if we have a valid wallet address)
  if (config.walletAddress && ethers.isAddress(config.walletAddress)) {
    console.log(`${COLORS.cyan}💰 Step 2: Fetching wallet balances from Polygon...${COLORS.reset}`);
    
    try {
      result.walletDiagnostics = await fetchWalletBalances(
        config.walletAddress,
        config.maxTradeSizeUsd
      );

      console.log(`${COLORS.cyan}   Wallet:${COLORS.reset}  ${result.walletDiagnostics.checksumAddress}`);
      
      // USDC balance (warning only - individual bots have their own wallets)
      if (result.walletDiagnostics.usdcSufficient) {
        console.log(`${COLORS.green}   ✅ USDC:   $${result.walletDiagnostics.usdcBalance.toFixed(2)} (sufficient for $${config.maxTradeSizeUsd} trades)${COLORS.reset}`);
      } else {
        console.log(`${COLORS.yellow}   ⚠️  USDC:   $${result.walletDiagnostics.usdcBalance.toFixed(2)} (low - but bots use their own wallets)${COLORS.reset}`);
        result.warnings.push(`Global wallet USDC balance ($${result.walletDiagnostics.usdcBalance.toFixed(2)}) is low - individual bot wallets will be used for trading`);
        // Don't force mock mode - bots have their own funded wallets
      }

      // MATIC balance
      if (result.walletDiagnostics.maticSufficient) {
        console.log(`${COLORS.green}   ✅ MATIC:  ${result.walletDiagnostics.maticBalance.toFixed(4)} (sufficient for gas)${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}   ❌ MATIC:  ${result.walletDiagnostics.maticBalance.toFixed(4)} (INSUFFICIENT - need at least ${MIN_MATIC_BALANCE})${COLORS.reset}`);
        result.warnings.push(`MATIC balance (${result.walletDiagnostics.maticBalance.toFixed(4)}) is less than minimum (${MIN_MATIC_BALANCE}) for gas`);
        result.forceMockMode = true;
      }

    } catch (error: any) {
      console.log(`${COLORS.yellow}   ⚠️  Could not fetch balances: ${error.message}${COLORS.reset}`);
      result.warnings.push(`Could not fetch wallet balances: ${error.message}`);
    }
  } else {
    console.log(`${COLORS.yellow}💰 Step 2: Skipping wallet diagnostics (no valid wallet address)${COLORS.reset}`);
  }
  console.log('');

  // Step 3: Dry-run signing test (only if we have a private key)
  if (config.privateKey) {
    console.log(`${COLORS.cyan}🔐 Step 3: Performing dry-run EIP-712 signing test...${COLORS.reset}`);
    
    const signingResult = await performDryRunSigningTest(config.privateKey);
    
    if (signingResult.success) {
      result.signingTestPassed = true;
      console.log(`${COLORS.green}   ✅ Signing test passed${COLORS.reset}`);
    } else {
      result.signingTestPassed = false;
      result.errors.push(`Signing test failed: ${signingResult.error}`);
      result.forceMockMode = true;
      console.log(`${COLORS.red}   ❌ Signing test failed: ${signingResult.error}${COLORS.reset}`);
    }
  } else {
    console.log(`${COLORS.yellow}🔐 Step 3: Skipping signing test (no private key)${COLORS.reset}`);
    result.forceMockMode = true;
  }
  console.log('');

  // Final verdict
  result.passed = result.envValid && result.signingTestPassed && !result.forceMockMode;

  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════════${COLORS.reset}`);
  if (result.passed) {
    console.log(`${COLORS.bgGreen}${COLORS.bright}  ✅ SAFETY VERIFICATION PASSED  ${COLORS.reset}`);
  } else {
    console.log(`${COLORS.bgYellow}${COLORS.bright}  ⚠️  SAFETY VERIFICATION: ISSUES FOUND  ${COLORS.reset}`);
    if (result.forceMockMode) {
      console.log(`${COLORS.yellow}     Worker will run in MOCK mode until issues are resolved.${COLORS.reset}`);
    }
  }
  console.log(`${COLORS.bright}${COLORS.blue}════════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log('');

  return result;
}

// ============================================================================
// Kill-Switch Logging
// ============================================================================

/**
 * Log when a kill-switch triggers.
 */
export function logKillSwitchTriggered(botId: string, result: KillSwitchResult): void {
  console.log('');
  console.log(`${COLORS.bgRed}${COLORS.bright} 🛑 KILL-SWITCH TRIGGERED ${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Bot:${COLORS.reset}        ${botId}`);
  console.log(`${COLORS.cyan}   Switch:${COLORS.reset}     ${result.killSwitch}`);
  console.log(`${COLORS.cyan}   Reason:${COLORS.reset}     ${result.reason}`);
  console.log(`${COLORS.yellow}   Action:${COLORS.reset}     Trade SKIPPED`);
  console.log('');
}

