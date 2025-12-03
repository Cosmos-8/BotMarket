# 🚀 How to Start BotMarket Locally

## Step-by-Step Instructions

### 1. Start Docker Desktop
**IMPORTANT**: Make sure Docker Desktop is running before proceeding!

- Open Docker Desktop application
- Wait until it shows "Docker Desktop is running"

### 2. Start Database & Redis
Open a terminal in this directory and run:
```bash
docker compose up -d
```

Wait a few seconds, then verify it's running:
```bash
docker ps
```

You should see `botmarket-postgres` and `botmarket-redis` containers.

### 3. Set Up Database
```bash
cd apps/api
pnpm db:generate
pnpm db:migrate
cd ../..
```

### 4. Create Environment Files

**Create `apps/api/.env`:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
BASE_RPC_URL="https://sepolia.base.org"
BASE_CHAIN_ID=84532
SIWE_DOMAIN="localhost"
SIWE_ORIGIN="http://localhost:3001"
BOT_KEY_ENCRYPTION_SECRET="change-this-to-a-random-secret-key-12345"
PORT=3001
NODE_ENV=development
```

**Create `apps/web/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

### 5. Start All Services

From the root directory, run:
```bash
pnpm dev
```

This will start:
- ✅ API server on **http://localhost:3001**
- ✅ Frontend on **http://localhost:3000**
- ✅ Trader worker (background)
- ✅ Metrics worker (background)

### 6. Open in Browser

Open **http://localhost:3000** in your browser!

---

## Quick Commands Reference

### Start everything:
```bash
docker compose up -d    # Start database/Redis
pnpm dev                # Start all services
```

### Stop everything:
```bash
docker compose down     # Stop database/Redis
# Press Ctrl+C to stop services
```

### Check if services are running:
```bash
docker ps               # Check Docker containers
curl http://localhost:3001/health  # Check API health
```

---

## Troubleshooting

### "Docker not running" error
→ Start Docker Desktop application first

### "Port already in use" error
→ Another service is using port 3000 or 3001. Stop that service or change ports in `.env` files

### "Database connection failed"
→ Make sure Docker containers are running: `docker ps`

### "Cannot find module" errors
→ Run `pnpm install` again

---

## What You Can Do Now

1. **Create a Bot**: Go to http://localhost:3000/create
2. **Browse Marketplace**: Go to http://localhost:3000/marketplace
3. **Test Signals**: On bot detail page, send test signals
4. **Simulate Fills**: Test metrics calculation with simulated fills

Enjoy testing! 🎉

