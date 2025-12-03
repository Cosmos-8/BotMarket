# Quick Start Guide

## Prerequisites

1. **Install pnpm** (if not already installed):
   ```bash
   npm install -g pnpm
   ```

2. **Start Docker Desktop** (for PostgreSQL and Redis)

## Setup Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

Wait a few seconds for services to start, then verify:
```bash
docker ps
```

You should see `botmarket-postgres` and `botmarket-redis` running.

### 3. Set Up Database

```bash
# Navigate to API directory
cd apps/api

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### 4. Configure Environment

Create `.env` files (or copy from `.env.example` if available):

**apps/api/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
BASE_RPC_URL="https://sepolia.base.org"
BASE_CHAIN_ID=84532
SIWE_DOMAIN="localhost"
SIWE_ORIGIN="http://localhost:3001"
BOT_KEY_ENCRYPTION_SECRET="your-random-secret-key-change-this"
PORT=3001
NODE_ENV=development
```

**apps/web/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

### 5. Start All Services

From the root directory:

```bash
pnpm dev
```

This will start:
- API server on http://localhost:3001
- Frontend on http://localhost:3000
- Trader worker (in background)
- Metrics worker (in background)

Or start individually:

```bash
# Terminal 1 - API
pnpm --filter api dev

# Terminal 2 - Frontend
pnpm --filter web dev

# Terminal 3 - Trader Worker
pnpm --filter worker-trader dev

# Terminal 4 - Metrics Worker
pnpm --filter worker-metrics dev
```

## Testing the Frontend

1. Open http://localhost:3000 in your browser

2. **Create a Bot:**
   - Click "Create Your First Bot" or navigate to `/create`
   - Fill in the form:
     - Market ID: Use a test Polymarket market ID (e.g., `0x...`)
     - Timeframe: Select 1h
     - Trade Size: 25
     - Max Position: 200
     - Cooldown: 30 minutes
     - Max Trades/Day: 12
   - Click "Create Bot"

3. **View Bot Details:**
   - After creating, you'll be redirected to the bot detail page
   - You can:
     - Send test signals (LONG, SHORT, CLOSE)
     - Simulate fills to test metrics

4. **Browse Marketplace:**
   - Navigate to `/marketplace`
   - View all public bots
   - Sort by ROI, PNL, or Win Rate

## API Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Create Bot (via API)
```bash
curl -X POST http://localhost:3001/bots \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "version": "1.0",
      "template": "tradingview-webhook",
      "market": {
        "marketId": "0xtest123",
        "timeframe": "1h"
      },
      "webhook": {
        "secret": "test-secret",
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

### Send Test Signal
```bash
curl -X POST http://localhost:3001/bots/BOT_ID/test-signal \
  -H "Content-Type: application/json" \
  -d '{"signal": "LONG"}'
```

### Simulate Fill
```bash
curl -X POST http://localhost:3001/admin/simulate-fill \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "BOT_ID",
    "orderId": "ORDER_ID",
    "price": 0.5,
    "size": 25,
    "fees": 0.1
  }'
```

## Troubleshooting

### Docker Issues
- Make sure Docker Desktop is running
- Check if ports 5432 and 6379 are available
- View logs: `docker logs botmarket-postgres` or `docker logs botmarket-redis`

### Database Issues
- Ensure PostgreSQL is running: `docker ps`
- Try resetting: `docker compose down -v` then `docker compose up -d`
- Re-run migrations: `cd apps/api && pnpm db:migrate`

### Port Already in Use
- Change ports in `docker-compose.yml` if 5432 or 6379 are taken
- Change API port in `apps/api/.env` (default: 3001)
- Change frontend port: `pnpm --filter web dev -- -p 3002`

### Frontend Not Connecting to API
- Check `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`
- Ensure API server is running on the correct port
- Check browser console for CORS errors

## Next Steps

1. **Add Wallet Connection**: Integrate wagmi/viem for Base wallet connection
2. **Deploy Contracts**: Deploy BotRegistry to Base testnet
3. **Configure Polymarket**: Add API credentials for live trading
4. **Add More Features**: 
   - Bot forking UI
   - Real-time metrics updates
   - Trade history visualization

