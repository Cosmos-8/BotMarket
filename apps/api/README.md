# BotMarket API

Node/TypeScript API server for BotMarket.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start database and Redis:
```bash
docker compose up -d
```

4. Run migrations:
```bash
pnpm db:migrate
```

5. Generate Prisma client:
```bash
pnpm db:generate
```

6. Start the server:
```bash
pnpm dev
```

## API Endpoints

### Authentication

- `POST /auth/siwe` - Generate SIWE message
- `POST /auth/verify` - Verify SIWE signature

### Bots

- `POST /bots` - Create a new bot
- `GET /bots` - List bots (with sorting, filtering, pagination)
- `GET /bots/:id` - Get bot details
- `POST /bots/:id/fork` - Fork a bot
- `POST /bots/:id/test-signal` - Send test signal (for demo)

### Webhooks

- `POST /webhook/:botId` - Receive TradingView webhook signals

### Marketplace

- `GET /marketplace` - Get leaderboard
- `GET /marketplace/:botId` - Get detailed bot stats

### Admin

- `POST /admin/simulate-fill` - Simulate a fill (for demo)
- `POST /admin/reset-bot/:botId` - Reset bot data (for demo)

### Health

- `GET /health` - Health check

## Environment Variables

See `.env.example` for required environment variables.

## Development

```bash
# Run in development mode
pnpm dev

# Run database migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

