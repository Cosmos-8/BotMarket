# Troubleshooting - Window Closes Immediately

## The Problem

If the window closes right after showing "Starting all services...", it means `pnpm dev` is failing or exiting immediately.

## Quick Fixes

### Option 1: Run Services Manually (Recommended for Debugging)

Open **3 separate terminal windows**:

**Terminal 1 - API:**
```bash
cd apps/api
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
pnpm dev
```

**Terminal 3 - Workers (optional):**
```bash
# Trader Worker
cd services/worker-trader
pnpm dev

# Metrics Worker (in another terminal)
cd services/worker-metrics
pnpm dev
```

This way you can see the actual error messages!

### Option 2: Check What's Wrong

Run this to see the error:
```bash
pnpm dev
```

Look for error messages - common issues:
- Missing dependencies: Run `pnpm install` again
- Port already in use: Close other apps using ports 3000/3001
- TypeScript errors: Check if all files are correct

### Option 3: Start Services One by One

1. **Start Docker first:**
   ```bash
   docker compose up -d
   ```

2. **Start API:**
   ```bash
   cd apps/api
   pnpm dev
   ```
   Keep this running, open a new terminal for next step

3. **Start Frontend (new terminal):**
   ```bash
   cd apps/web
   pnpm dev
   ```

## Common Issues

### "Cannot find module"
**Fix:** Run `pnpm install` in the root directory

### "Port 3000/3001 already in use"
**Fix:** 
- Close other applications using those ports
- Or change ports in `.env` files

### "EADDRINUSE"
**Fix:** Something is already running on that port. Find and close it:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Services start but immediately exit
**Fix:** Check the error logs. Usually means:
- Missing environment variables
- Database connection failed
- TypeScript compilation errors

## Verify Services Are Running

1. **Check API:** Open http://localhost:3001/health in browser
2. **Check Frontend:** Open http://localhost:3000 in browser
3. **Check Docker:** Run `docker ps` - should see postgres and redis

## Still Not Working?

Run each service individually to see the exact error:

```bash
# Test API
cd apps/api
pnpm dev

# Test Frontend (in new terminal)
cd apps/web  
pnpm dev
```

This will show you the actual error messages!

