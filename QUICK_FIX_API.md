# Quick Fix: API Server Not Running

## The Problem
The frontend is running on port 3000, but the API server on port 3001 is not running. This causes "Network error" when trying to create bots.

## Quick Solution

### Option 1: Use the Updated start-simple.bat
I've updated `start-simple.bat` to properly start both services. Try running it again:
```
start-simple.bat
```

This should open **two windows**:
1. "BotMarket API" - running on port 3001
2. "BotMarket Frontend" - running on port 3000

### Option 2: Manually Start API (If start-simple.bat didn't work)

**Open a new terminal/PowerShell window and run:**
```bash
cd apps/api
pnpm dev
```

You should see:
```
API server running on port 3001
```

**Keep this window open!** The API must be running for the frontend to work.

### Option 3: Check What's Running

**Check if API is running:**
```bash
# In PowerShell
Test-NetConnection -ComputerName localhost -Port 3001
```

**Or check in browser:**
Open http://localhost:3001/health

If you see `{"status":"healthy",...}`, the API is running.

## Verify Both Are Running

1. **Frontend**: http://localhost:3000 (should show the homepage)
2. **API**: http://localhost:3001/health (should return JSON)

If both work, try creating a bot again!

## If API Window Didn't Open

The `start-simple.bat` should open two windows. If only one opened:

1. **Manually start API**: Open a new terminal and run:
   ```bash
   cd apps/api
   pnpm dev
   ```

2. **Or use start-all.bat**: I created a new `start-all.bat` that includes database setup and should be more reliable.

## Still Not Working?

Check the API terminal window for error messages. Common issues:
- Database not connected
- Port 3001 already in use
- Missing dependencies

Share the error message from the API window and I can help fix it!

