import {
  BotConfig,
  Order,
  Fill,
  BotMetrics,
  ParsedSignal,
} from './schemas';
import {
  SignalType,
  OrderSide,
  Outcome,
  OrderStatus,
  BotVisibility,
} from './constants';

// Re-export schema types
export type {
  BotConfig,
  Order,
  Fill,
  BotMetrics,
  ParsedSignal,
  SignalMap,
  MarketConfig,
  WebhookConfig,
  SizingConfig,
  RiskConfig,
  ExecutionConfig,
} from './schemas';

// Re-export constant types
export type {
  SignalType,
  OrderSide,
  Outcome,
  OrderStatus,
  BotVisibility,
  Currency,
  Timeframe,
} from './constants';

// Database entity types
export interface User {
  id: string;
  baseAddress: string;
  createdAt: Date;
}

export interface Bot {
  id: string;
  botId: string;
  creator: string;
  parentBotId: string | null;
  visibility: BotVisibility;
  metadataURI: string | null;
  configHash: string;
  createdAt: Date;
}

export interface BotConfigEntity {
  id: string;
  botId: string;
  configJSON: BotConfig;
  version: string;
  createdAt: Date;
}

export interface BotKey {
  id: string;
  botId: string;
  encryptedPrivKey: string;
  keyVersion: string;
  createdAt: Date;
}

export interface Signal {
  id: string;
  botId: string;
  receivedAt: Date;
  payloadHash: string;
  parsedSignalJSON: ParsedSignal;
  signalType: SignalType;
}

export interface OrderEntity extends Order {
  id: string;
  placedAt: Date;
}

export interface FillEntity extends Fill {
  id: string;
  fillAt: Date;
}

export interface BotMetricsEntity extends BotMetrics {
  id: string;
  updatedAt: Date;
}

// Polymarket API types
export interface PolymarketMarket {
  id: string;
  conditionId: string;
  clobTokenIds: string[];
  outcomes: string[];
  title: string;
  active: boolean;
  volume: number;
  endDate: string;
}

export interface PolymarketOrder {
  tokenId: string;
  side: OrderSide;
  price: string;
  size: string;
  nonce: number;
  expiration: number;
}

export interface PolymarketFill {
  fillId: string;
  orderId: string;
  tokenId: string;
  price: string;
  size: string;
  fees: string;
  timestamp: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BotListQuery {
  sort?: 'roi' | 'pnl' | 'winrate' | 'created';
  creator?: string;
  visibility?: BotVisibility;
  page?: number;
  limit?: number;
}

