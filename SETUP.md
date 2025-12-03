# BotMarket Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose
- Foundry (for contracts)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 3. Set Up Database

```bash
# Generate Prisma client
cd apps/api
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### 4. Configure Environment Variables

Create `.env` files in each service:

**apps/api/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
BASE_RPC_URL="https://sepolia.base.org"
BASE_CHAIN_ID=84532
SIWE_DOMAIN="localhost"
SIWE_ORIGIN="http://localhost:3001"
BOT_KEY_ENCRYPTION_SECRET="your-random-secret-key-here"
PORT=3001
```

**services/worker-trader/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
POLYGON_RPC_URL="https://polygon-rpc.com"
POLYMARKET_GAMMA_API="https://gamma-api.polymarket.com"
POLYMARKET_CLOB_API="https://clob.polymarket.com"
BOT_KEY_ENCRYPTION_SECRET="your-random-secret-key-here"
```

**services/worker-metrics/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
```

### 5. Start Services

```bash
# Start all services in development
pnpm dev

# Or start individually:
pnpm --filter api dev
pnpm --filter worker-trader dev
pnpm --filter worker-metrics dev
```

## API Endpoints

The API server runs on `http://localhost:3001` by default.

### Health Check
```bash
curl http://localhost:3001/health
```

### Create a Bot
```bash
curl -X POST http://localhost:3001/bots \
  -H "Content-Type: application/json" \
  -H "X-Address: 0x..." \
  -H "X-Signature: ..." \
  -H "X-Message: ..." \
  -d '{
    "config": {
      "version": "1.0",
      "template": "tradingview-webhook",
      "market": {
        "marketId": "0x...",
        "timeframe": "1h"
      },
      "webhook": {
        "secret": "your-webhook-secret",
        "signalMap": {
          "LONG": { "side": "BUY", "outcome": "YES" },
          "SHORT": { "side": "BUY", "outcome": "NO" },
          "CLOSE": { "action": "EXIT" }
        }
      },
      "sizing": { "type": "fixed_usd", "value": 25 },
      "risk": {
        "maxPositionUsd": 200,
        "cooldownMinutes": 30,
        "maxTradesPerDay": 12
      },
      "execution": {
        "orderType": "limit",
        "maxSlippageBps": 50
      }
    },
    "visibility": "PUBLIC"
  }'
```

### Send Webhook Signal
```bash
curl -X POST http://localhost:3001/webhook/bot_123 \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-webhook-secret" \
  -d '{"signal": "LONG"}'
```

## Development

### Build Contracts

```bash
cd packages/contracts
forge build
forge test
```

### Database Management

```bash
# Open Prisma Studio
cd apps/api
pnpm db:studio

# Create new migration
pnpm db:migrate --name migration_name
```

## Testing

### Test Signal Endpoint

```bash
curl -X POST http://localhost:3001/bots/bot_123/test-signal \
  -H "Content-Type: application/json" \
  -d '{"signal": "LONG"}'
```

### Simulate Fill (Admin)

```bash
curl -X POST http://localhost:3001/admin/simulate-fill \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "bot_123",
    "orderId": "order_456",
    "price": 0.5,
    "size": 25,
    "fees": 0.1
  }'
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps

# Check logs
docker logs botmarket-postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps

# Test Redis connection
redis-cli ping
```

### Worker Not Processing Jobs

- Check Redis connection
- Verify queue names match between API and workers
- Check worker logs for errors

## Next Steps

1. Deploy contracts to Base testnet/mainnet
2. Configure Polymarket API credentials for live trading
3. Set up proper key management (KMS) for production
4. Implement full EIP-712 order signing
5. Add market price fetching for accurate PNL calculation

