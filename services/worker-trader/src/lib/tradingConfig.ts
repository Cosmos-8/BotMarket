/**
 * Trading Configuration Helper
 * 
 * Provides safe access to trading mode and safety caps from environment variables.
 * All values have sensible defaults for mock trading.
 */

// ============================================================================
// Types
// ============================================================================

export type TradingMode = 'mock' | 'gamma' | 'mainnet';

export interface TradingConfig {
  mode: TradingMode;
  maxTradeSizeUsd: number;
  maxDailyNotionalUsd: number;
  privateKey: string | null;
  walletAddress: string | null;
  clobApiUrl: string;
  gammaApiUrl: string;
}

export interface SafetyCapViolation {
  type: 'trade_size' | 'daily_notional';
  limit: number;
  requested: number;
  message: string;
}

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
// Configuration Loading
// ============================================================================

/**
 * Parse trading mode from environment with validation and fallbacks.
 */
function parseTradingMode(): TradingMode {
  const modeEnv = process.env.TRADING_MODE?.toLowerCase();
  
  // Handle explicit mode setting
  if (modeEnv === 'gamma') return 'gamma';
  if (modeEnv === 'mainnet') return 'mainnet';
  if (modeEnv === 'mock') return 'mock';
  
  // Backwards compatibility: ENABLE_LIVE_TRADING=true → mainnet
  if (process.env.ENABLE_LIVE_TRADING === 'true') {
    console.warn(`${COLORS.yellow}⚠️  ENABLE_LIVE_TRADING is deprecated. Use TRADING_MODE=mainnet instead.${COLORS.reset}`);
    return 'mainnet';
  }
  
  // Default to mock mode (safest option)
  return 'mock';
}

/**
 * Parse a numeric environment variable with a default value.
 */
function parseNumericEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`${COLORS.yellow}⚠️  Invalid ${key}="${value}", using default ${defaultValue}${COLORS.reset}`);
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Get the CLOB API URL based on trading mode.
 * Both Gamma and mainnet use the same CLOB endpoint.
 */
function getClobApiUrl(mode: TradingMode): string {
  // Custom URL takes precedence
  if (process.env.POLYMARKET_CLOB_API) {
    return process.env.POLYMARKET_CLOB_API;
  }
  
  // Polymarket uses the same CLOB endpoint for both environments
  // The difference is in the API key derivation and chain ID
  return 'https://clob.polymarket.com';
}

/**
 * Get the Gamma API URL (market data).
 */
function getGammaApiUrl(): string {
  return process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';
}

/**
 * Get the full trading configuration from environment variables.
 * 
 * @returns TradingConfig with all settings and safe defaults
 */
export function getTradingConfig(): TradingConfig {
  const mode = parseTradingMode();
  
  return {
    mode,
    maxTradeSizeUsd: parseNumericEnv('MAX_TRADE_SIZE_USD', 1),
    maxDailyNotionalUsd: parseNumericEnv('MAX_DAILY_NOTIONAL_USD', 10),
    privateKey: process.env.POLYMARKET_PRIVATE_KEY || null,
    walletAddress: process.env.POLYMARKET_WALLET_ADDRESS || null,
    clobApiUrl: getClobApiUrl(mode),
    gammaApiUrl: getGammaApiUrl(),
  };
}

// ============================================================================
// Safety Cap Validation
// ============================================================================

/**
 * Check if a trade size exceeds the maximum allowed.
 */
export function checkTradeSizeCap(
  sizeUsd: number,
  config: TradingConfig
): SafetyCapViolation | null {
  if (sizeUsd <= config.maxTradeSizeUsd) {
    return null;
  }
  
  return {
    type: 'trade_size',
    limit: config.maxTradeSizeUsd,
    requested: sizeUsd,
    message: `Trade size $${sizeUsd.toFixed(2)} exceeds max $${config.maxTradeSizeUsd.toFixed(2)}`,
  };
}

/**
 * Check if adding a trade would exceed daily notional cap.
 * 
 * @param currentDailyNotional - Total notional already traded today
 * @param newSizeUsd - Size of the new trade to add
 * @param config - Trading configuration with caps
 */
export function checkDailyNotionalCap(
  currentDailyNotional: number,
  newSizeUsd: number,
  config: TradingConfig
): SafetyCapViolation | null {
  const projectedTotal = currentDailyNotional + newSizeUsd;
  
  if (projectedTotal <= config.maxDailyNotionalUsd) {
    return null;
  }
  
  return {
    type: 'daily_notional',
    limit: config.maxDailyNotionalUsd,
    requested: projectedTotal,
    message: `Daily notional $${projectedTotal.toFixed(2)} would exceed cap $${config.maxDailyNotionalUsd.toFixed(2)}`,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if trading mode is live (gamma or mainnet).
 */
export function isLiveMode(config: TradingConfig): boolean {
  return config.mode === 'gamma' || config.mode === 'mainnet';
}

/**
 * Check if the configuration is valid for live trading.
 * Returns null if valid, or an error message if not.
 */
export function validateLiveTradingConfig(config: TradingConfig): string | null {
  if (!isLiveMode(config)) {
    return null; // Mock mode doesn't need validation
  }
  
  if (!config.privateKey) {
    return 'POLYMARKET_PRIVATE_KEY is required for live trading';
  }
  
  if (config.privateKey.length < 64) {
    return 'POLYMARKET_PRIVATE_KEY appears to be invalid (too short)';
  }
  
  return null;
}

// ============================================================================
// Startup Banner
// ============================================================================

/**
 * Log the trading mode banner at startup.
 * This provides clear visual indication of which mode the worker is running in.
 */
export function logTradingModeBanner(config: TradingConfig): void {
  const { mode, maxTradeSizeUsd, maxDailyNotionalUsd } = config;
  
  console.log('');
  console.log(`${COLORS.bright}${COLORS.blue}╔══════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  
  switch (mode) {
    case 'mock':
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.green}✅ Trader Worker running in MOCK mode.${COLORS.reset}                            ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     No real trades will be sent.                                       ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      break;
      
    case 'gamma':
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.yellow}⚠️  Trader Worker running in LIVE GAMMA mode.${COLORS.reset}                       ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     Real orders will be sent to Polymarket Gamma environment.          ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     ${COLORS.cyan}Safety caps: Max trade $${maxTradeSizeUsd.toFixed(2)} | Daily cap $${maxDailyNotionalUsd.toFixed(2)}${COLORS.reset}                   ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      break;
      
    case 'mainnet':
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}  ${COLORS.red}🚨 Trader Worker running in LIVE MAINNET mode.${COLORS.reset}                      ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     ${COLORS.bright}${COLORS.magenta}Real orders will be sent to Polymarket mainnet.${COLORS.reset}                 ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      console.log(`${COLORS.bright}${COLORS.blue}║${COLORS.reset}     ${COLORS.cyan}Safety caps enforced: Max trade $${maxTradeSizeUsd.toFixed(2)} | Daily cap $${maxDailyNotionalUsd.toFixed(2)}${COLORS.reset}     ${COLORS.bright}${COLORS.blue}║${COLORS.reset}`);
      break;
  }
  
  console.log(`${COLORS.bright}${COLORS.blue}╚══════════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log('');
}

