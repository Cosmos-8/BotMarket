# 🚀 How to Start Localhost

## Quick Start (Windows)

### Option 1: Use the Batch Script (Easiest)
1. **Start Docker Desktop** first (important!)
2. Double-click `start.bat`
3. Wait for services to start
4. Open http://localhost:3000 in your browser

### Option 2: Manual Steps

#### 1. Start Docker Desktop
- Open Docker Desktop application
- Wait until it shows "Docker Desktop is running"

#### 2. Start Database & Redis
```bash
docker compose up -d
```

#### 3. Set Up Database (First Time Only)
```bash
cd apps/api
pnpm db:generate
pnpm db:migrate
cd ../..
```

#### 4. Create Environment Files

**Create `apps/api/.env`** (copy this content):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/botmarket"
REDIS_URL="redis://localhost:6379"
BASE_RPC_URL="https://sepolia.base.org"
BASE_CHAIN_ID=84532
SIWE_DOMAIN="localhost"
SIWE_ORIGIN="http://localhost:3001"
BOT_KEY_ENCRYPTION_SECRET="botmarket-dev-secret-key-change-in-production-12345"
PORT=3001
NODE_ENV=development
```

**Create `apps/web/.env.local`** (copy this content):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

#### 5. Start All Services
```bash
pnpm dev
```

This starts:
- ✅ API: http://localhost:3001
- ✅ Frontend: http://localhost:3000
- ✅ Workers: Running in background

#### 6. Open Browser
Go to **http://localhost:3000**

---

## Verify Everything is Running

### Check Docker:
```bash
docker ps
```
Should show `botmarket-postgres` and `botmarket-redis`

### Check API:
Open http://localhost:3001/health in browser or:
```bash
curl http://localhost:3001/health
```

### Check Frontend:
Open http://localhost:3000 in browser

---

## Troubleshooting

### ❌ "Docker not running"
**Fix**: Start Docker Desktop application

### ❌ "Port already in use"
**Fix**: 
- Close other applications using ports 3000 or 3001
- Or change ports in `.env` files

### ❌ "Database connection failed"
**Fix**: 
- Make sure Docker is running: `docker ps`
- Wait a few seconds after starting Docker
- Try: `docker compose restart`

### ❌ "Cannot find module"
**Fix**: Run `pnpm install` again

### ❌ "Migration failed"
**Fix**: 
- Make sure Docker containers are running
- Wait 10 seconds after starting Docker
- Run manually: `cd apps/api && pnpm db:migrate`

---

## Stop Services

- Press `Ctrl+C` in the terminal to stop services
- Run `docker compose down` to stop Docker containers

---

## What to Do Next

1. **Create a Bot**: http://localhost:3000/create
2. **Browse Marketplace**: http://localhost:3000/marketplace  
3. **Test Signals**: On bot detail page, click "Send Test Signal"
4. **Simulate Fills**: Test metrics with "Simulate Fill" button

Enjoy! 🎉

