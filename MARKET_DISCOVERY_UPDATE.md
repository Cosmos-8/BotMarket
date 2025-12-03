# Market Discovery Update

## Changes Made

### 1. Updated Bot Configuration Schema
- **Removed**: `marketId` field (static market ID)
- **Added**: `currency` field (Bitcoin, Ethereum, Solana, XRP)
- **Kept**: `timeframe` field (15m, 1h, 4h, 1d)

### 2. Market Discovery Service
Created `apps/api/src/lib/marketDiscovery.ts` that:
- Automatically discovers current market IDs based on currency + timeframe
- Caches upcoming markets for instant trading when they open
- Uses Polymarket's event slug pattern: `{currency}-up-or-down-{month}-{day}-{hour}{period}-et`
- Handles EST/EDT timezone (Polymarket's timezone)
- Cleans up expired cache entries automatically

### 3. Frontend Form Update
- Replaced "Market ID" input with "Currency" dropdown
- Added helpful descriptions explaining automatic market discovery
- Shows which currencies are available (Bitcoin, Ethereum, Solana, XRP)

### 4. Trader Worker Update
- Now uses market discovery to get current market ID dynamically
- No longer requires static market ID in config
- Automatically finds the right market based on currency + timeframe

### 5. Background Cache Service
- Automatically caches upcoming markets for all active bots
- Refreshes cache every 30 minutes
- Pre-caches markets when a bot is created

## How It Works

1. **User Creates Bot**: Selects currency (e.g., Bitcoin) and timeframe (e.g., 1h)
2. **Market Discovery**: System automatically discovers current market ID
3. **Caching**: Upcoming markets are pre-cached so bot can trade immediately when they open
4. **Trading**: When signal arrives, bot uses cached market ID for instant execution

## Market Discovery Flow

```
Signal Arrives
    ↓
Get Bot Config (currency + timeframe)
    ↓
Check Cache for Current Market
    ↓
If not cached, discover via Polymarket API
    ↓
Cache the market ID
    ↓
Execute trade on discovered market
```

## Cache Strategy

- **Current Markets**: Cached with expiration time
- **Upcoming Markets**: Pre-cached 24 hours ahead
- **Cleanup**: Expired entries removed automatically
- **Refresh**: All bot markets refreshed every 30 minutes

## Benefits

✅ No need to manually find market IDs
✅ Bot automatically trades on current market
✅ Upcoming markets pre-cached for instant trading
✅ Works across all timeframes (15m, 1h, 4h, 1d)
✅ Supports multiple currencies

## Testing

To test market discovery:
1. Create a bot with currency + timeframe
2. Check that markets are being cached (logs will show)
3. Send a test signal - bot should find current market automatically

