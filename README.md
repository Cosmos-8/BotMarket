# BotMarket — No-Code Polymarket Bot Builder + Marketplace

**Hackathon build: Midwest Blockchain Conference (MBC) 2025**

## 🚀 Quick Start

1. **Start everything**: Double-click `start-all.bat`
2. **Open app**: http://localhost:3000
3. **Create bot**: Select currency + timeframe, get webhook URL
4. **Connect TradingView**: See `TRADINGVIEW_SETUP.md` for instructions

## 📖 Documentation

- **[HACKATHON_DEMO_GUIDE.md](./HACKATHON_DEMO_GUIDE.md)** - Complete demo walkthrough
- **[TRADINGVIEW_SETUP.md](./TRADINGVIEW_SETUP.md)** - TradingView alert setup
- **[QUICK_START.md](./QUICK_START.md)** - Quick setup guide
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions

## ✨ Features

- ✅ **No-Code Bot Creation**: Simple UI to create trading bots
- ✅ **TradingView Integration**: Connect any TradingView strategy
- ✅ **Automatic Market Discovery**: Finds and caches Polymarket markets
- ✅ **Risk Management**: Cooldowns, position limits, trade limits
- ✅ **Performance Metrics**: Real-time PNL, ROI, win rate tracking
- ✅ **Marketplace**: Browse, fork, and improve bots

## TL;DR

BotMarket lets non-developers create Polymarket trading bots using simple templates (starting with TradingView webhooks), publish them to a marketplace with performance metrics (PNL/ROI), and let others fork + tweak bots to improve results.

- Frontend + marketplace: **Base** (built separately)
- Trading execution: **Polymarket on Polygon**
- Funding path (planned): **Base USDC → Polygon USDC via Circle CCTP → Polymarket collateral**
- MVP template: TradingView webhook bots for crypto markets (15m / 1h / 4h / 1d)

## Project Structure

```
/apps
  /api              # Node TS API (auth, bots, webhook receiver)
/services
  /worker-trader    # executes trades on Polymarket via Polygon key
  /worker-metrics   # computes PnL/ROI and leaderboard
/packages
  /contracts        # Foundry Base contracts
  /shared           # zod schema, types, helpers
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for Postgres + Redis)
- Foundry (for contracts)

### Installation

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d

# Run database migrations
pnpm --filter api db:migrate

# Start all services
pnpm dev
```

### Environment Setup

See `.env.example` files in each service directory for required environment variables.

## Development

```bash
# Run all services in development
pnpm dev

# Run specific service
pnpm --filter api dev
pnpm --filter worker-trader dev
pnpm --filter worker-metrics dev
```

## API Endpoints

See API documentation in `/apps/api/README.md` for detailed endpoint documentation.

## License

MIT

