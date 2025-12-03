import { z } from 'zod';
import {
  SIGNAL_TYPES,
  ORDER_SIDES,
  OUTCOMES,
  ORDER_TYPES,
  SIZING_TYPES,
  TIMEFRAMES,
  CURRENCIES,
  BOT_VISIBILITY,
  ORDER_STATUS,
} from './constants';

// Signal mapping schema
export const SignalMapSchema = z.object({
  LONG: z.object({
    side: z.enum([ORDER_SIDES.BUY, ORDER_SIDES.SELL]),
    outcome: z.enum([OUTCOMES.YES, OUTCOMES.NO]),
  }),
  SHORT: z.object({
    side: z.enum([ORDER_SIDES.BUY, ORDER_SIDES.SELL]),
    outcome: z.enum([OUTCOMES.YES, OUTCOMES.NO]),
  }),
  CLOSE: z.object({
    action: z.literal('EXIT'),
  }),
});

// Market configuration schema
export const MarketConfigSchema = z.object({
  currency: z.enum(CURRENCIES),
  timeframe: z.enum(TIMEFRAMES),
  // marketId is now resolved dynamically via market discovery
});

// Webhook configuration schema
export const WebhookConfigSchema = z.object({
  secret: z.string(),
  signalMap: SignalMapSchema,
});

// Sizing configuration schema
export const SizingConfigSchema = z.object({
  type: z.enum([SIZING_TYPES.FIXED_USD, SIZING_TYPES.PERCENTAGE]),
  value: z.number().positive(),
});

// Risk configuration schema
export const RiskConfigSchema = z.object({
  maxPositionUsd: z.number().positive(),
  cooldownMinutes: z.number().int().min(0),
  maxTradesPerDay: z.number().int().positive(),
});

// Execution configuration schema
export const ExecutionConfigSchema = z.object({
  orderType: z.enum([ORDER_TYPES.LIMIT, ORDER_TYPES.MARKET]),
  maxSlippageBps: z.number().int().min(0).max(10000), // 0-10000 basis points (0-100%)
});

// Bot configuration schema (matches the provided JSON structure)
export const BotConfigSchema = z.object({
  version: z.string(),
  template: z.literal('tradingview-webhook'),
  market: MarketConfigSchema,
  webhook: WebhookConfigSchema,
  sizing: SizingConfigSchema,
  risk: RiskConfigSchema,
  execution: ExecutionConfigSchema,
});

export type BotConfig = z.infer<typeof BotConfigSchema>;
export type SignalMap = z.infer<typeof SignalMapSchema>;
export type MarketConfig = z.infer<typeof MarketConfigSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
export type SizingConfig = z.infer<typeof SizingConfigSchema>;
export type RiskConfig = z.infer<typeof RiskConfigSchema>;
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;

// Webhook payload schemas (supporting multiple formats)
export const WebhookPayloadSchema = z.union([
  z.object({
    signal: z.enum([SIGNAL_TYPES.LONG, SIGNAL_TYPES.SHORT, SIGNAL_TYPES.CLOSE]),
  }),
  z.object({
    text: z.string(),
  }),
  z.object({
    message: z.string(),
  }),
  z.object({
    direction: z.enum([SIGNAL_TYPES.LONG, SIGNAL_TYPES.SHORT]),
  }),
]);

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Parsed signal schema
export const ParsedSignalSchema = z.object({
  signalType: z.enum([SIGNAL_TYPES.LONG, SIGNAL_TYPES.SHORT, SIGNAL_TYPES.CLOSE]),
  timestamp: z.string().datetime().optional(),
  rawPayload: z.record(z.unknown()),
});

export type ParsedSignal = z.infer<typeof ParsedSignalSchema>;

// Order schema
export const OrderSchema = z.object({
  botId: z.string(),
  marketId: z.string(),
  outcome: z.enum([OUTCOMES.YES, OUTCOMES.NO]),
  side: z.enum([ORDER_SIDES.BUY, ORDER_SIDES.SELL]),
  price: z.number().positive(),
  size: z.number().positive(),
  status: z.enum([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.FILLED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.PARTIALLY_FILLED,
  ]),
  orderId: z.string().optional(),
  tokenId: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

// Fill schema
export const FillSchema = z.object({
  botId: z.string(),
  orderId: z.string(),
  price: z.number().positive(),
  size: z.number().positive(),
  fees: z.number().min(0),
  fillId: z.string().optional(),
});

export type Fill = z.infer<typeof FillSchema>;

// Bot metrics schema
export const BotMetricsSchema = z.object({
  botId: z.string(),
  pnlUsd: z.number(),
  roiPct: z.number(),
  trades: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  maxDrawdown: z.number().max(0),
});

export type BotMetrics = z.infer<typeof BotMetricsSchema>;

// Create bot request schema
export const CreateBotRequestSchema = z.object({
  config: BotConfigSchema,
  visibility: z.enum([BOT_VISIBILITY.PUBLIC, BOT_VISIBILITY.PRIVATE]),
  metadataURI: z.string().url().optional(),
  feeBps: z.number().int().min(0).max(10000).optional(), // 0-10000 basis points (0-100%)
});

export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;

// Fork bot request schema
export const ForkBotRequestSchema = z.object({
  config: BotConfigSchema.optional(), // Optional override config
  metadataURI: z.string().url().optional(),
});

export type ForkBotRequest = z.infer<typeof ForkBotRequestSchema>;

