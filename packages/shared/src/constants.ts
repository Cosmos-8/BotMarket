// Signal types
export const SIGNAL_TYPES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  CLOSE: 'CLOSE',
} as const;

export type SignalType = typeof SIGNAL_TYPES[keyof typeof SIGNAL_TYPES];

// Order sides
export const ORDER_SIDES = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export type OrderSide = typeof ORDER_SIDES[keyof typeof ORDER_SIDES];

// Outcomes
export const OUTCOMES = {
  YES: 'YES',
  NO: 'NO',
} as const;

export type Outcome = typeof OUTCOMES[keyof typeof OUTCOMES];

// Order status
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// Bot visibility
export const BOT_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;

export type BotVisibility = typeof BOT_VISIBILITY[keyof typeof BOT_VISIBILITY];

// Sizing types
export const SIZING_TYPES = {
  FIXED_USD: 'fixed_usd',
  PERCENTAGE: 'percentage',
} as const;

export type SizingType = typeof SIZING_TYPES[keyof typeof SIZING_TYPES];

// Order types
export const ORDER_TYPES = {
  LIMIT: 'limit',
  MARKET: 'market',
} as const;

export type OrderType = typeof ORDER_TYPES[keyof typeof ORDER_TYPES];

// Timeframes
export const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

// Currencies
export const CURRENCIES = ['Bitcoin', 'Ethereum', 'Solana', 'XRP'] as const;
export type Currency = typeof CURRENCIES[number];

