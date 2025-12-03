# BotMarket - Hackathon Demo Guide

## 🚀 Quick Start (2 Minutes)

### 1. Start Everything
Double-click `start-all.bat` (or `start-simple.bat` if you've already set up Docker)

This will:
- ✅ Start Docker (PostgreSQL + Redis)
- ✅ Run database migrations
- ✅ Start API server (port 3001)
- ✅ Start Frontend (port 3000)

### 2. Open the App
Go to: **http://localhost:3000**

### 3. Create Your First Bot
1. Click "Create Bot"
2. Select:
   - **Currency**: Bitcoin (or Ethereum, Solana, XRP)
   - **Timeframe**: 1 hour (or 15m, 4h, 1d)
   - Leave other settings as default
3. Click "Create Bot"

### 4. Get Your Webhook URL
- On the bot detail page, copy the **Webhook URL**
- This is what you'll use in TradingView

### 5. Set Up TradingView Alert
See `TRADINGVIEW_SETUP.md` for detailed instructions, or:
1. Add indicator to TradingView chart
2. Create alert → Settings tab
3. Set condition (e.g., RSI crossing 30 for BUY)
4. Message tab → Enter `[BUY]` or `[SELL]`
5. Notifications tab → Paste webhook URL
6. Create alert

### 6. Test It
- On bot detail page, click "Send Test Signal"
- Select signal type (LONG/SHORT/CLOSE)
- Click "Send Test Signal"
- Check bot metrics update

## 🎯 Demo Flow (5 Minutes)

### Part 1: Create Bot (1 min)
1. Show bot creation form
2. Explain currency + timeframe selection
3. Create bot
4. Show webhook URL

### Part 2: TradingView Integration (2 min)
1. Open TradingView
2. Show how to set up alert
3. Explain message format (`[BUY]`, `[SELL]`, `[CLOSE]`)
4. Show webhook URL configuration

### Part 3: Test Signal (1 min)
1. Send test signal from bot detail page
2. Show signal received in API logs
3. Explain how it would execute on Polymarket

### Part 4: Marketplace (1 min)
1. Show marketplace with bots
2. Show sorting by ROI/PNL
3. Show bot details and metrics
4. Explain fork functionality

## 📋 Key Features to Highlight

### ✅ Automatic Market Discovery
- No need to manually find market IDs
- Bot automatically discovers current markets
- Caches upcoming markets for instant trading

### ✅ Risk Management
- Cooldown periods
- Max position size
- Max trades per day
- All configurable per bot

### ✅ Performance Metrics
- Real-time PNL tracking
- ROI calculation
- Win rate
- Max drawdown

### ✅ Marketplace & Forking
- Browse top-performing bots
- Fork any public bot
- Tweak settings and deploy

## 🛠️ Troubleshooting

### API Not Running?
- Check if port 3001 is in use
- Restart API: `start-api.bat`
- Check API logs for errors

### Database Errors?
- Make sure Docker is running: `docker ps`
- Restart Docker: `docker compose restart`
- Run migrations: `cd apps/api && pnpm db:migrate`

### Frontend Not Loading?
- Check if port 3000 is in use
- Make sure API is running first
- Check browser console for errors

## 📝 What's Working

✅ Bot creation with currency + timeframe
✅ Market discovery and caching
✅ Webhook receiver for TradingView signals
✅ Signal parsing (multiple formats)
✅ Risk rule enforcement
✅ Metrics calculation
✅ Marketplace with sorting
✅ Bot forking
✅ Test signal endpoint
✅ Fill simulation (for demo)

## ⚠️ What's Not Implemented (For Demo)

- **Live Polymarket Trading**: Structure is ready, needs API keys
- **Full SIWE Auth**: Basic auth works, full flow is roadmap
- **On-Chain Events**: Contract ready, integration is roadmap
- **Real Price Data**: Uses placeholder prices for demo

## 🎤 Talking Points

1. **"No-Code Bot Builder"**: Users create bots through simple UI, no coding required
2. **"TradingView Integration"**: Connect any TradingView strategy to Polymarket
3. **"Market Discovery"**: Automatically finds and trades current markets
4. **"Risk Management"**: Built-in cooldowns, position limits, trade limits
5. **"Performance Tracking"**: Real-time metrics, leaderboard, fork tracking
6. **"Marketplace"**: Discover, fork, and improve bots

## 🔗 Important URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **TradingView Setup Guide**: http://localhost:3000/tradingview-setup

## 📚 Documentation Files

- `TRADINGVIEW_SETUP.md` - Complete TradingView alert setup guide
- `SETUP.md` - Detailed setup instructions
- `QUICK_START.md` - Quick start guide
- `IMPLEMENTATION_SUMMARY.md` - Technical overview

## 🎉 Ready for Demo!

Everything is set up and ready. Just run `start-all.bat` and you're good to go!

