# @botmarket/shared

Shared package containing types, schemas, and utilities used across BotMarket services.

## Contents

- **Schemas**: Zod schemas for bot configuration, signals, orders, fills, metrics
- **Types**: TypeScript types for all entities
- **Constants**: Signal types, order sides, outcomes, etc.
- **Utils**: Helper functions for encryption, webhook parsing, etc.

## Usage

```typescript
import { BotConfigSchema, parseWebhookSignal, SIGNAL_TYPES } from '@botmarket/shared';

// Validate bot config
const config = BotConfigSchema.parse(botConfigData);

// Parse webhook signal
const signal = parseWebhookSignal(webhookPayload);

// Use constants
if (signal?.signalType === SIGNAL_TYPES.LONG) {
  // Handle LONG signal
}
```

## Building

```bash
pnpm build
```

