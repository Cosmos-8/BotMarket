# 🤖 BotMarket

**No-Code Polymarket Trading Bot Builder & Marketplace**

Build, deploy, and share automated trading bots for Polymarket prediction markets — no coding required. Fork successful strategies, track performance, and manage risk with USDC-denominated positions on Polygon.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Monorepo Structure](#-monorepo-structure)
- [Why Polygon](#-why-polygon)
- [Polymarket Integration](#-polymarket-integration)
- [USDC & Direct Deposits](#-usdc--direct-deposits)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Dev Stack](#-running-the-dev-stack)
- [On-Chain Contract](#-on-chain-contract)
- [Features](#-features)
- [Limitations & Roadmap](#-limitations--roadmap)

---

## 🎯 Project Overview

BotMarket democratizes algorithmic trading on Polymarket by providing:

1. **No-Code Bot Builder** — Configure trading bots via a simple UI. Select markets (BTC, ETH, SOL price predictions), set position sizes, risk limits, and connect to TradingView alerts.

2. **Bot Marketplace** — Browse public bots sorted by ROI, PNL, and win rate. Fork successful strategies with one click.

3. **On-Chain Registry** — Bots are registered on Polygon, creating a transparent, verifiable record of bot creation and forking lineage.

4. **USDC-Based Risk Management** — All positions are sized in USDC with direct deposits on Polygon. Each bot has its own isolated wallet for fund management.

5. **Dashboard** — Comprehensive dashboard to manage your trading pool, all bots, deposits, withdrawals, and view performance statistics.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔧 **No-Code Configuration** | Create bots by selecting currency, timeframe, position size, and risk parameters |
| 📊 **TradingView Integration** | Receive webhook signals (LONG/SHORT/CLOSE) from TradingView alerts |
| 🏪 **Bot Marketplace** | Browse, sort, and fork public bots based on performance metrics |
| ⛓️ **On-Chain Registry** | Bot metadata stored on Polygon Mainnet via `BotRegistry.sol` |
| 💵 **USDC Balances** | Direct USDC deposits on Polygon to your trading pool and individual bots |
| 📈 **Performance Tracking** | Real-time PNL, ROI, win rate, and max drawdown metrics |
| 🔒 **Risk Controls** | Cooldown periods, max trades per day, position size limits |
| 🎛️ **Bot Management** | Start/stop bots, allocate funds, withdraw profits, export private keys |
| 📊 **Dashboard** | Centralized dashboard to manage all bots and funds |
| 🔑 **Private Key Export** | Export bot wallet private keys to import into your own wallet |
| 🎭 **Mock Trading Mode** | Safe demo mode simulates trades without real funds |
| 🤖 **Automated Claiming** | Automatic claiming of winning positions from resolved Polymarket markets |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   /create   │  │ /marketplace│  │  /bots/:id  │  │    /dashboard       │ │
│  │  Bot Form   │  │  Bot Grid   │  │ Bot Details │  │  Bot Management     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │              RainbowKit Wallet (Polygon Mainnet)                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API SERVER (Express)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   /bots     │  │ /marketplace│  │  /webhook   │  │     /balance        │ │
│  │   CRUD      │  │   Listing   │  │  Signals    │  │   USDC Funding      │ │
│  │  Start/Stop │  │             │  │             │  │   Withdrawals       │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────┐ │
│  │  /dashboard │  │ /polymarket │  │ /bots/:id/   │  │   /balance/bot/:id  │ │
│  │  User Stats │  │ Market Data │  │ export-key   │  │   Withdraw           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            │ BullMQ
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
        │   Worker-Trader   │   │  Worker-Metrics   │   │      Redis        │
        │  Process Signals  │   │  Update Stats     │   │   Job Queues      │
        │  Execute Trades   │   │  Calculate ROI    │   │                   │
        │  Claim Positions  │   │  Track PNL        │   │                   │
        └─────────┬─────────┘   └─────────┬─────────┘   └───────────────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
                  ┌───────────────────────┐
                  │     PostgreSQL        │
                  │  Bots, Orders, Fills  │
                  │  Metrics, Balances    │
                  │  Users (polygonAddr)  │
                  └───────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Polymarket    │  │   TradingView    │  │      Polygon Mainnet         │  │
│  │   Gamma API     │  │    Webhooks      │  │   BotRegistry Contract      │  │
│  │  Market Data     │  │  LONG/SHORT/     │  │   0x5971...6958             │  │
│  │  CLOB API        │  │     CLOSE        │  │   USDC (0x3c49...3359)      │  │
│  │  Order Execution │  │                 │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Structure

```
BotMarket/
├── apps/
│   ├── api/                    # Express.js REST API
│   │   ├── prisma/             # Database schema & migrations
│   │   │   ├── schema.prisma   # Prisma schema (Polygon addresses)
│   │   │   └── seed.ts         # Demo data seeder
│   │   └── src/
│   │       ├── routes/         # API endpoints
│   │       │   ├── bots.ts     # Bot CRUD, start/stop, export-key
│   │       │   ├── marketplace.ts
│   │       │   ├── webhook.ts  # TradingView signals
│   │       │   ├── balance.ts  # USDC funding, withdrawals
│   │       │   ├── dashboard.ts # User dashboard data
│   │       │   └── polymarket.ts # Market data
│   │       ├── lib/            # Shared utilities
│   │       └── services/       # Business logic
│   │
│   └── web/                    # Next.js 14 Frontend
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── page.tsx    # Home
│           │   ├── create/     # Bot builder
│           │   ├── marketplace/ # Bot marketplace
│           │   ├── dashboard/   # User dashboard
│           │   ├── bots/[id]/   # Bot details
│           │   └── tradingview-setup/ # TradingView guide
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks
│           └── config/         # Contract addresses (Polygon)
│
├── services/
│   ├── worker-trader/          # Trade execution worker
│   │   └── src/
│   │       ├── processors/     # Signal processing
│   │       ├── lib/
│   │       │   ├── polymarket.ts # Polymarket API client
│   │       │   ├── polymarketSigning.ts # EIP-712 signing
│   │       │   ├── claimPositions.ts # Auto-claiming
│   │       │   └── tradingConfig.ts
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
│   │       ├── utils.ts        # Encryption, wallet generation
│   │       └── marketDiscovery.ts  # Polymarket slug generation
│   │
│   └── contracts/              # Solidity smart contracts
│       ├── src/
│       │   └── BotRegistry.sol # On-chain bot registry
│       ├── script/             # Foundry deploy scripts
│       └── deployments/       # Deployment addresses
│           └── polygonMainnet.json
│
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # PNPM workspace definition
└── env.*.txt                   # Environment templates
```

---

## ⛓️ Why Polygon

BotMarket is built on **Polygon** for several strategic reasons:

1. **Low Transaction Costs** — Polygon's low gas fees make bot operations economically viable.

2. **Polymarket Native** — Polymarket operates on Polygon, enabling direct USDC deposits and seamless integration.

3. **EVM Compatibility** — Our Solidity contracts work out-of-the-box, and the existing tooling (Foundry, ethers.js) just works.

4. **Mature Ecosystem** — Polygon's established DeFi ecosystem provides reliable infrastructure for trading applications.

5. **Direct USDC** — Native USDC on Polygon (Circle's official USDC) eliminates the need for bridging.

### BotRegistry Contract

The `BotRegistry.sol` contract on Polygon Mainnet provides:

- **Bot Creation** — `createBot(configHash, metadataURI, visibility)` registers a new bot on-chain
- **Bot Forking** — `forkBot(parentBotId, configHash)` creates a derivative with lineage tracking
- **Visibility Control** — PUBLIC or PRIVATE bot settings
- **Event Logging** — All operations emit events for indexing

**Deployed Address:** `0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958`

**View on PolygonScan:** [https://polygonscan.com/address/0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958](https://polygonscan.com/address/0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958)

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
  "message": "LONG"  // or "SHORT", "CLOSE", "[BUY]", "[SELL]"
}
```

The worker processes these signals:
- **LONG** → Buy YES outcome
- **SHORT** → Buy NO outcome  
- **CLOSE** → Exit current position

### Automated Position Claiming

When Polymarket markets resolve, winning positions are automatically claimed and funds are credited back to bot accounts. The system:
- Checks for resolved markets hourly
- Identifies winning positions
- Claims tokens and converts to USDC
- Updates bot balances automatically

---

## 💵 USDC & Direct Deposits

### Current Implementation

BotMarket uses **direct USDC deposits on Polygon**:

1. **User Trading Pool** — Users deposit USDC directly to their Polygon proxy wallet
2. **Bot Allocation** — Allocate funds from the trading pool to individual bots
3. **Bot Wallets** — Each bot has its own isolated Polygon wallet for trading
4. **Withdrawals** — Withdraw from bots to pool (internal) or directly to wallet (on-chain)

### Deposit Flow

```
User Wallet (Polygon)
    ↓ (USDC Transfer)
User Proxy Wallet (Trading Pool)
    ↓ (Internal Allocation)
Bot Wallet
    ↓ (Trading)
Polymarket Positions
```

### Withdrawal Options

- **To Pool** — Internal transfer (no gas fees) - move funds back to trading pool
- **To Wallet** — On-chain transfer to user's wallet (requires gas)

### USDC Details

- **Token Address:** `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (Circle's native USDC on Polygon)
- **Decimals:** 6
- **Network:** Polygon Mainnet

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TailwindCSS, RainbowKit, wagmi |
| **Backend** | Express.js, Node.js 20+ |
| **Database** | PostgreSQL 16, Prisma ORM |
| **Queue** | Redis 7, BullMQ |
| **Blockchain** | Polygon Mainnet, Solidity, Foundry |
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
- Foundry (for contract deployment) - [Install Foundry](https://book.getfoundry.sh/getting-started/installation)

### 1. Clone & Install

```bash
git clone https://github.com/Cosmos-8/BotMarket.git
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
cd apps/api
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

### 5. Build Shared Package

```bash
cd packages/shared && pnpm build && cd ../..
```

### 6. Start Development

```bash
# Start all services
pnpm dev

# Or use the convenience script (Windows)
start-botmarket.bat
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

# Polygon RPC
POLYGON_RPC_URL="https://polygon-rpc.com"

# Security
BOT_KEY_ENCRYPTION_SECRET="your-secret-key-change-in-production"
SIWE_DOMAIN="localhost"
SIWE_ORIGIN="http://localhost:3001"

# Trading Mode
# Options: mock, gamma, mainnet
TRADING_MODE=mock

# Polymarket API
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
POLYMARKET_CLOB_API=https://clob.polymarket.com

# Polymarket Builder Program (Optional - for bypassing wallet restrictions)
# Get these from: https://polymarket.com/settings?tab=builder
# These credentials allow orders to be attributed to your builder account
# and can help bypass wallet authorization restrictions
POLYMARKET_BUILDER_API_KEY=your-api-key
POLYMARKET_BUILDER_SECRET=your-secret
POLYMARKET_BUILDER_PASSPHRASE=your-passphrase

# Safety Caps
MAX_TRADE_SIZE_USD=25
MAX_DAILY_NOTIONAL_USD=100

# Server
PORT=3001
NODE_ENV=development
```

### Web (`apps/web/.env.local`)

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Chain
NEXT_PUBLIC_POLYGON_CHAIN_ID=137

# Webhook Base URL (for TradingView)
# For local development, use ngrok: ngrok http 3001
# Then set: NEXT_PUBLIC_WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
NEXT_PUBLIC_WEBHOOK_BASE_URL=http://localhost:3001

# WalletConnect (optional for local dev)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Deployed Contract
NEXT_PUBLIC_BOT_REGISTRY_ADDRESS=0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958

# USDC Address on Polygon
NEXT_PUBLIC_USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
```

---

## 🗄 Database Setup

### Schema Overview

```prisma
model User {
  id                  String   @id
  polygonAddress      String   @unique  // User's Polygon wallet
  usdcBalance         Float    @default(0)
  proxyWalletAddress  String?  // Trading pool wallet
  encryptedProxyKey   String?  // Encrypted private key
  createdBots         Bot[]
}

model Bot {
  id          String   @id
  botId       String   @unique  // On-chain ID
  creator     String   // Polygon address
  visibility  String   // PUBLIC | PRIVATE
  isActive    Boolean  @default(false)  // Start/stop flag
  configHash  String
  metrics     BotMetrics?
  orders      Order[]
  fills       Fill[]
  keys        BotKey[]  // Bot wallet keys
}

model BotKey {
  botId           String   @unique
  encryptedPrivKey String  // Encrypted bot wallet key
}
```

### Commands

```bash
# Generate Prisma client
cd apps/api
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed demo data
npx prisma db seed

# Reset everything
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
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
- `services/worker-trader` — Trade processor, position claimer
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

**Address (Polygon Mainnet):** `0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958`

**View on PolygonScan:** [https://polygonscan.com/address/0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958](https://polygonscan.com/address/0x59713Ff4DFAC5b9C2e6cd695FdB7FE43B2276958)

### Contract Interface

```solidity
interface IBotRegistry {
    // Create a new bot
    function createBot(
        bytes32 configHash,
        string memory metadataURI,
        string memory visibility
    ) external returns (uint256 botId);

    // Fork an existing bot
    function forkBot(
        uint256 parentBotId,
        bytes32 newConfigHash,
        string memory metadataURI
    ) external returns (uint256 newBotId);

    // Get bot info
    function getBot(uint256 botId) external view returns (
        address creator,
        bytes32 configHash,
        string memory metadataURI,
        string memory visibility,
        uint256 parentBotId
    );
}
```

### Deploying (if needed)

```bash
cd packages/contracts

# Set private key
export PRIVATE_KEY=0x...

# Deploy to Polygon Mainnet
forge script script/DeployBotRegistry.s.sol:DeployBotRegistryScript \
  --rpc-url https://polygon-rpc.com \
  --broadcast \
  --verify
```

---

## 🎬 Features

### Bot Management

- **Create Bots** — Configure trading bots with currency, timeframe, risk parameters
- **Start/Stop Bots** — Control when bots are actively trading
- **Bot Dashboard** — View all your bots, balances, and performance in one place
- **Fork Bots** — Clone successful strategies from the marketplace

### Fund Management

- **Trading Pool** — Deposit USDC to your main trading pool
- **Bot Allocation** — Allocate funds from pool to individual bots
- **Withdrawals** — Withdraw from bots to pool (internal) or wallet (on-chain)
- **Balance Tracking** — Real-time balance tracking for pool and individual bots

### Trading Features

- **TradingView Integration** — Connect TradingView alerts via webhooks
- **Signal Processing** — Automatic processing of LONG/SHORT/CLOSE signals
- **Order Execution** — Submit orders to Polymarket CLOB API
- **Position Tracking** — Track all positions and fills
- **Automated Claiming** — Automatic claiming of winning positions

### Security & Control

- **Private Key Export** — Export bot wallet private keys to import into your own wallet
- **Polymarket Profiles** — Each bot has its own Polymarket profile (wallet address)
- **Encrypted Storage** — Bot wallet keys are encrypted at rest
- **Wallet Verification** — Signature-based authentication for sensitive operations

---

## 🚧 Limitations & Roadmap

### Current Limitations (MVP)

| Limitation | Reason | Production Solution |
|------------|--------|---------------------|
| Mock trading only | Safe demo mode | Integrate CLOB API with real keys |
| Simplified position claiming | CTF contract integration pending | Full CTF redemption implementation |
| Basic UI | Time constraints | Full design system, mobile responsive |

### Roadmap

**Phase 1: Production Trading (Q1)**
- [x] Direct USDC deposits on Polygon
- [x] Bot start/stop functionality
- [x] Withdrawal system
- [x] Dashboard for bot management
- [x] Private key export
- [ ] Full CTF position claiming implementation
- [ ] Real order execution with user's API keys
- [ ] Position tracking and P&L calculation

**Phase 2: Advanced Features (Q2)**
- [ ] Strategy backtesting
- [ ] Multi-market bots
- [ ] Copy trading subscriptions
- [ ] Mobile app
- [ ] Advanced analytics

**Phase 3: Scale & Optimize (Q3)**
- [ ] Multi-chain support
- [ ] Advanced risk management
- [ ] Social features
- [ ] API for third-party integrations

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Polymarket** — Prediction market infrastructure
- **Polygon** — Scalable blockchain platform
- **Circle** — USDC stablecoin
- **RainbowKit** — Wallet connection UI
- **Prisma** — Database ORM
- **Foundry** — Smart contract development toolkit

---

<p align="center">
  Built with ❤️ for automated trading on Polymarket
</p>
