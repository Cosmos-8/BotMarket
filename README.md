 # 🤖 BotMarket

**No-Code Polymarket Trading Bot Builder & Marketplace**

Build, deploy, and share automated trading bots for Polymarket prediction markets — no coding required. Fork successful strategies, track performance, and manage risk with USDC-denominated positions.

> 🏆 Built for **MBC25 Hackathon** — targeting Base Main Track, Polymarket Bounty, and Circle USDC Bounty.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Monorepo Structure](#-monorepo-structure)
- [Why Base](#-why-base)
- [Polymarket Integration](#-polymarket-integration)
- [USDC & Circle CCTP Story](#-usdc--circle-cctp-story)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Dev Stack](#-running-the-dev-stack)
- [On-Chain Contract](#-on-chain-contract)
- [Demo Flow for Judges](#-demo-flow-for-hackathon-judges)
- [Limitations & Roadmap](#-limitations--roadmap)

---

## 🎯 Project Overview

BotMarket democratizes algorithmic trading on Polymarket by providing:

1. **No-Code Bot Builder** — Configure trading bots via a simple UI. Select markets (BTC, ETH, SOL price predictions), set position sizes, risk limits, and connect to TradingView alerts.

2. **Bot Marketplace** — Browse public bots sorted by ROI, PNL, and win rate. Fork successful strategies with one click.

3. **On-Chain Registry** — Bots are registered on Base, creating a transparent, verifiable record of bot creation and forking lineage.

4. **USDC-Based Risk Management** — All positions are sized in USDC, with a clear path to production using Circle's CCTP for cross-chain collateral bridging.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔧 **No-Code Configuration** | Create bots by selecting currency, timeframe, position size, and risk parameters |
| 📊 **TradingView Integration** | Receive webhook signals (LONG/SHORT/CLOSE) from TradingView alerts |
| 🏪 **Bot Marketplace** | Browse, sort, and fork public bots based on performance metrics |
| ⛓️ **On-Chain Registry** | Bot metadata stored on Base Sepolia via `BotRegistry.sol` |
| 💵 **USDC Balances** | Fund trading accounts with USDC (mock for hackathon, production-ready architecture) |
| 📈 **Performance Tracking** | Real-time PNL, ROI, win rate, and max drawdown metrics |
| 🔒 **Risk Controls** | Cooldown periods, max trades per day, position size limits |
| 🎭 **Mock Trading Mode** | Safe demo mode simulates trades without real funds |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   /create   │  │ /marketplace│  │  /bots/:id  │  │  RainbowKit Wallet  │ │
│  │  Bot Form   │  │  Bot Grid   │  │ Bot Details │  │   Base Sepolia      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API SERVER (Express)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   /bots     │  │ /marketplace│  │  /webhook   │  │     /balance        │ │
│  │   CRUD      │  │   Listing   │  │  Signals    │  │   USDC Funding      │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            │ BullMQ
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
        │   Worker-Trader   │   │  Worker-Metrics   │   │      Redis        │
        │  Process Signals  │   │  Update Stats     │   │   Job Queues      │
        │  Execute Trades   │   │  Calculate ROI    │   │                   │
        └─────────┬─────────┘   └─────────┬─────────┘   └───────────────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
                  ┌───────────────────────┐
                  │     PostgreSQL        │
                  │  Bots, Orders, Fills  │
                  │  Metrics, Balances    │
                  └───────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Polymarket    │  │   TradingView   │  │      Base Sepolia           │  │
│  │   Gamma API     │  │    Webhooks     │  │   BotRegistry Contract      │  │
│  │  Market Data    │  │  LONG/SHORT/    │  │   0x2239...d427             │  │
│  └─────────────────┘  │     CLOSE       │  └─────────────────────────────┘  │
│                       └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Structure

```
BotMarket/
├── apps/
│   ├── api/                    # Express.js REST API
│   │   ├── prisma/             # Database schema & migrations
│   │   │   ├── schema.prisma   # Prisma schema
│   │   │   └── seed.ts         # Demo data seeder
│   │   └── src/
│   │       ├── routes/         # API endpoints
│   │       │   ├── bots.ts     # Bot CRUD
│   │       │   ├── marketplace.ts
│   │       │   ├── webhook.ts  # TradingView signals
│   │       │   └── balance.ts  # USDC funding
│   │       ├── lib/            # Shared utilities
│   │       └── services/       # Business logic
│   │
│   └── web/                    # Next.js 14 Frontend
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── page.tsx    # Home
│           │   ├── create/     # Bot builder
│           │   ├── marketplace/
│           │   └── bots/[id]/  # Bot details
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks (useWallet, useUsdcBalance)
│           └── config/         # Contract addresses
│
├── services/
│   ├── worker-trader/          # Trade execution worker
│   │   └── src/
│   │       ├── processors/     # Signal processing
│   │       └── lib/            # Mock execution, Prisma
│   │
│   └── worker-metrics/         # Metrics calculation worker
│       └── src/
│           └── processors/     # ROI, PNL calculations
│
├── packages/
│   ├── shared/                 # Shared types, schemas, utilities
│   │   └── src/
│   │       ├── types.ts        # TypeScript interfaces
│   │       ├── schemas.ts      # Zod validation schemas
│   │       ├── constants.ts    # Shared constants
│   │       └── marketDiscovery.ts  # Polymarket slug generation
│   │
│   └── contracts/              # Solidity smart contracts
│       ├── src/
│       │   └── BotRegistry.sol # On-chain bot registry
│       ├── script/             # Foundry deploy scripts
│       └── deployments/        # Deployment addresses
│
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # PNPM workspace definition
└── env.*.txt                   # Environment templates
```

---

## ⛓️ Why Base

BotMarket is built on **Base** for several strategic reasons:

1. **Low Transaction Costs** — Registering bots and forking strategies on Base costs fractions of a cent, making the marketplace economically viable.

2. **Coinbase Ecosystem** — Base's integration with Coinbase Smart Wallet enables seamless onboarding for mainstream users.

3. **EVM Compatibility** — Our Solidity contracts work out-of-the-box, and the existing tooling (Foundry, ethers.js) just works.

4. **Growing DeFi Ecosystem** — Base's TVL growth indicates strong user adoption, perfect for a trading-focused application.

### BotRegistry Contract

The `BotRegistry.sol` contract on Base Sepolia provides:

- **Bot Creation** — `createBot(configHash, metadataURI, visibility)` registers a new bot on-chain
- **Bot Forking** — `forkBot(parentBotId, configHash)` creates a derivative with lineage tracking
- **Visibility Control** — PUBLIC or PRIVATE bot settings
- **Event Logging** — All operations emit events for indexing

---

## 🎰 Polymarket Integration

BotMarket integrates with Polymarket's prediction markets through:

### Market Discovery

```typescript
// Automatic market slug generation for crypto price predictions
generateEventSlug('Bitcoin', '1h')  // → "will-the-price-of-bitcoin-be-up-..."
generateEventSlug('Ethereum', '4h') // → "will-the-price-of-ethereum-be-up-..."
```

### Supported Markets

| Currency | Timeframes | Market Type |
|----------|------------|-------------|
| Bitcoin | 15m, 1h, 4h, 1d | Price Up/Down |
| Ethereum | 15m, 1h, 4h, 1d | Price Up/Down |
| Solana | 15m, 1h, 4h, 1d | Price Up/Down |
| XRP | 15m, 1h, 4h, 1d | Price Up/Down |

### Signal Processing

TradingView alerts send webhooks with signals:

```json
{
  "botId": "bot_abc123",
  "secret": "webhook_secret",
  "signal": "LONG"  // or "SHORT", "CLOSE"
}
```

The worker processes these signals:
- **LONG** → Buy YES outcome
- **SHORT** → Buy NO outcome  
- **CLOSE** → Exit current position

---

## 💵 USDC & Circle CCTP Story

### Current Implementation (Hackathon MVP)

BotMarket uses an **off-chain USDC balance** system:

```typescript
// Fund trading balance (mock)
POST /balance/fund
{ "address": "0x...", "amount": 100 }

// Check balance
GET /balance/0x...
{ "address": "0x...", "usdcBalance": 100 }
```

All bot positions are sized in USDC, providing:
- Clear risk denominations ($25 per trade, $200 max position)
- Familiar unit of account for traders
- Direct mapping to Polymarket's USDC collateral

### Production Roadmap with Circle CCTP

In production, BotMarket will leverage **Circle's Cross-Chain Transfer Protocol (CCTP)**:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    Base     │  CCTP   │   Circle    │  CCTP   │   Polygon   │
│   (USDC)    │ ──────► │   Bridge    │ ──────► │   (USDC)    │
│  User Funds │         │             │         │  Polymarket │
└─────────────┘         └─────────────┘         └─────────────┘
```

**Why CCTP?**
- Native USDC burning/minting (no wrapped tokens)
- Secure, audited bridge infrastructure
- Sub-minute finality for position funding
- Same USDC on both chains

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TailwindCSS, RainbowKit, wagmi |
| **Backend** | Express.js, Node.js 20+ |
| **Database** | PostgreSQL 16, Prisma ORM |
| **Queue** | Redis 7, BullMQ |
| **Blockchain** | Base Sepolia, Solidity, Foundry |
| **Validation** | Zod schemas |
| **Package Manager** | pnpm (workspaces) |
| **Containerization** | Docker Compose |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Git

### 1. Clone & Install

```bash
git clone https://github.com/your-org/BotMarket.git
cd BotMarket
pnpm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 3. Configure Environment

```bash
# API environment
cp env.api.txt apps/api/.env

# Web environment  
cp env.web.txt apps/web/.env.local

# Workers (share API config)
cp apps/api/.env services/worker-trader/.env
cp apps/api/.env services/worker-metrics/.env
```

### 4. Setup Database

```bash
# Generate Prisma client, run migrations, seed demo data
pnpm db:setup
```

### 5. Build Shared Package

```bash
cd packages/shared && pnpm build && cd ../..
```

### 6. Start Development

```bash
pnpm dev
```

Access:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001

---

## 🔐 Environment Variables

### API (`apps/api/.env`)

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Base RPC
BASE_RPC_URL="https://sepolia.base.org"
BASE_CHAIN_ID=84532

# Security
BOT_KEY_ENCRYPTION_SECRET="your-secret-key-change-in-production"

# Server
PORT=3001
NODE_ENV=development

# Trading Mode (false = mock mode for demo)
ENABLE_LIVE_TRADING=false
```

### Web (`apps/web/.env.local`)

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Chain
NEXT_PUBLIC_BASE_CHAIN_ID=84532

# WalletConnect (optional for local dev)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Deployed Contract
NEXT_PUBLIC_BOT_REGISTRY_ADDRESS=0x2239F90B2EE92a3ef47525A4041e840602B1d427
```

---

## 🗄 Database Setup

### Schema Overview

```prisma
model User {
  id          String   @id
  baseAddress String   @unique
  usdcBalance Float    @default(0)
  createdBots Bot[]
}

model Bot {
  id          String   @id
  botId       String   @unique  // On-chain ID
  creator     String
  visibility  String   // PUBLIC | PRIVATE
  configHash  String
  metrics     BotMetrics?
  orders      Order[]
  fills       Fill[]
}

model BotMetrics {
  botId       String   @unique
  pnlUsd      Float
  roiPct      Float
  trades      Int
  winRate     Float
  maxDrawdown Float
}
```

### Commands

```bash
# Generate Prisma client
pnpm --filter @botmarket/api db:generate

# Run migrations
pnpm --filter @botmarket/api db:migrate

# Seed demo data
pnpm --filter @botmarket/api db:seed

# Reset everything
pnpm --filter @botmarket/api db:reset

# Open Prisma Studio
pnpm --filter @botmarket/api db:studio
```

---

## 🖥 Running the Dev Stack

### All Services (Recommended)

```bash
pnpm dev
```

Starts:
- `apps/web` — Next.js frontend on :3000
- `apps/api` — Express API on :3001
- `services/worker-trader` — Trade processor
- `services/worker-metrics` — Metrics calculator

### Individual Services

```bash
# Frontend only
pnpm --filter @botmarket/web dev

# API only
pnpm --filter @botmarket/api dev

# Trader worker only
pnpm --filter @botmarket/worker-trader dev
```

### Verify Services

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## ⛓️ On-Chain Contract

### BotRegistry.sol

**Address (Base Sepolia):** `0x2239F90B2EE92a3ef47525A4041e840602B1d427`

**View on BaseScan:** [https://sepolia.basescan.org/address/0x2239F90B2EE92a3ef47525A4041e840602B1d427](https://sepolia.basescan.org/address/0x2239F90B2EE92a3ef47525A4041e840602B1d427)

### Contract Interface

```solidity
interface IBotRegistry {
    // Create a new bot
    function createBot(
        bytes32 configHash,
        string memory metadataURI,
        bool isPublic
    ) external returns (uint256 botId);

    // Fork an existing bot
    function forkBot(
        uint256 parentBotId,
        bytes32 newConfigHash
    ) external returns (uint256 newBotId);

    // Get bot info
    function getBot(uint256 botId) external view returns (
        address creator,
        bytes32 configHash,
        string memory metadataURI,
        bool isPublic,
        uint256 parentBotId,
        uint256 forkCount
    );
}
```

### Deploying (if needed)

```bash
cd packages/contracts

# Set private key
export PRIVATE_KEY=0x...

# Deploy to Base Sepolia
forge script script/DeployBotRegistry.s.sol:DeployBotRegistryScript \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

---

## 🎬 Demo Flow for Hackathon Judges

### 1. View Marketplace (30 sec)

1. Navigate to http://localhost:3000/marketplace
2. See 5 demo bots with performance metrics:
   - BTC 4h Momentum: **+31.7% ROI**
   - BTC 15m Trend: **+24.5% ROI**
   - ETH 1h Breakout: **+18.2% ROI**
3. Note the **BotRegistry contract address** displayed
4. Click "View on BaseScan" to verify on-chain

### 2. Connect Wallet (15 sec)

1. Click "Connect Wallet" in header
2. Select wallet (MetaMask, Coinbase, etc.)
3. Switch to Base Sepolia if prompted
4. See connected address displayed

### 3. Fund USDC Balance (20 sec)

1. See "USDC Trading Balance" panel
2. Click "+$50" to add mock USDC
3. Balance updates to $50.00 USDC
4. Note Circle CCTP copy: *"bridged to Polygon using Circle's CCTP"*

### 4. Create a Bot (45 sec)

1. Navigate to http://localhost:3000/create
2. Configure bot:
   - Currency: **Bitcoin**
   - Timeframe: **1 hour**
   - Trade Size: **$25**
   - Max Position: **$200**
3. Click "Create Bot"
4. Bot registered in database

### 5. View Trade Execution (30 sec)

1. Check terminal running `pnpm dev`
2. See worker logs:
   ```
   🤖 Starting Trader Worker...
   ║  ⚠️  MOCK TRADING MODE              ║
   🔗 Trader Worker Redis connected
   ```
3. Explain: In production, signals flow from TradingView → Webhook → Queue → Trade

### 6. API Demo (Optional, 30 sec)

```bash
# Get balance
curl http://localhost:3001/balance/0x123...

# Fund balance
curl -X POST http://localhost:3001/balance/fund \
  -H "Content-Type: application/json" \
  -d '{"address":"0x123...","amount":100}'

# List marketplace bots
curl http://localhost:3001/marketplace
```

---

## 🚧 Limitations & Roadmap

### Current Limitations (Hackathon MVP)

| Limitation | Reason | Production Solution |
|------------|--------|---------------------|
| Mock trading only | No Polymarket API keys | Integrate CLOB API with real keys |
| Off-chain USDC balance | Simplified for demo | On-chain USDC with CCTP bridging |
| No real wallet signing | Bot creation not calling contract | Integrate contract calls in UI |
| Basic UI | Time constraints | Full design system, mobile responsive |

### Roadmap

**Phase 1: Production Trading (Q1)**
- [ ] Integrate Polymarket CLOB API
- [ ] Real order execution with user's API keys
- [ ] Position tracking and P&L calculation

**Phase 2: On-Chain Integration (Q1)**
- [ ] Call `createBot()` from UI with wallet signature
- [ ] Store configHash on-chain for verification
- [ ] Fork tracking with on-chain lineage

**Phase 3: USDC & CCTP (Q2)**
- [ ] Real USDC deposits on Base
- [ ] Circle CCTP integration for Polygon bridging
- [ ] Automated collateral management

**Phase 4: Advanced Features (Q2-Q3)**
- [ ] Strategy backtesting
- [ ] Multi-market bots
- [ ] Copy trading subscriptions
- [ ] Mobile app

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Polymarket** — Prediction market infrastructure
- **Base** — L2 blockchain platform
- **Circle** — USDC and CCTP protocols
- **RainbowKit** — Wallet connection UI
- **Prisma** — Database ORM

---

<p align="center">
  Built with ❤️ for <strong>MBC25 Hackathon</strong>
</p>
