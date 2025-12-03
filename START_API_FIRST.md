# ⚠️ API Server Not Running - Quick Fix

## The Problem
Your frontend is running on port 3000, but the **API server on port 3001 is not running**. This is why you're getting the network error.

## Solution: Start the API Server

### Method 1: Use the Script (Easiest)
**Double-click `start-api.bat`** - this will start the API server in a new window.

### Method 2: Manual Start
1. Open a **new** PowerShell/Command Prompt window
2. Navigate to the project:
   ```bash
   cd "C:\Users\Ashar\Desktop\MBC Hack"
   ```
3. Start the API:
   ```bash
   cd apps/api
   pnpm dev
   ```

You should see:
```
API server running on port 3001
```

**Keep this window open!** The API must stay running.

## Verify It's Working

1. **Check API Health**: Open http://localhost:3001/health in your browser
   - Should return: `{"status":"healthy",...}`

2. **Try Creating Bot Again**: Go back to http://localhost:3000/create and try again

## You Need TWO Windows Open

- **Window 1**: API Server (port 3001) - from `start-api.bat` or manual start
- **Window 2**: Frontend (port 3000) - already running

Both must be running at the same time!

## Quick Test

After starting the API, test it:
```bash
curl http://localhost:3001/health
```

Or just open http://localhost:3001/health in your browser.

Once you see the health check working, try creating a bot again!

