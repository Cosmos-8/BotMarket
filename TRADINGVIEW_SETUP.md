# TradingView Alert Setup Guide

This guide will walk you through setting up TradingView alerts to trigger your BotMarket trading bot.

## Prerequisites

1. A BotMarket bot created (with currency and timeframe selected)
2. Your bot's webhook URL (found on your bot's detail page)
3. A TradingView account (free or paid)

## Step-by-Step Instructions

### Step 1: Add Indicator to Your Chart

1. Open TradingView and navigate to your chart
2. Click the **"Indicators"** button at the top of the screen
3. Search for and add your preferred indicator (e.g., RSI, MACD, Moving Averages, etc.)
4. Configure the indicator settings as desired

### Step 2: Create Alert

1. Click the **"Alert"** button at the top of the TradingView screen (bell icon)
2. The "Create alert on [SYMBOL]" dialog will appear

### Step 3: Configure Alert Settings

#### Settings Tab

1. **Symbols**: Should already be set to your trading pair (e.g., BTCUSDT)
   
2. **Condition**: 
   - Click the first dropdown and select your indicator (e.g., "RSI", "MACD", "VMC Cipher_B_Divergences")
   - Click the second dropdown and select the condition that triggers the alert:
     - For **UP/BUY signals**: Select "Buy" or any bullish condition
     - For **DOWN/SELL signals**: Select "Sell" or any bearish condition
   
3. **Interval**: 
   - Set to **"Same as chart"** (this ensures the alert matches your bot's timeframe)
   - The second dropdown should match your bot's timeframe (e.g., "4 hours" for a 4h bot)
   
4. **Trigger**: 
   - Select **"Only once"** or **"Once per bar close"** (recommended)
   - This prevents duplicate alerts
   
5. **Expiration**: 
   - Select **"Open-ended alert"**
   - This keeps the alert active indefinitely

### Step 4: Configure Alert Message

1. Click the **"Message"** tab

2. **Alert name** (optional): Give your alert a descriptive name

3. **Message**: Enter one of the following formats:
   
   **Option 1 - Simple Format:**
   ```
   LONG
   ```
   or
   ```
   SHORT
   ```
   
   **Option 2 - Explicit Format (Recommended):**
   ```
   [BUY]
   ```
   or
   ```
   [SELL]
   ```
   
   **Option 3 - Descriptive Format:**
   ```
   Buy signal - LONG
   ```
   or
   ```
   Sell signal - SHORT
   ```
   
   **For closing positions:**
   ```
   CLOSE
   ```
   or
   ```
   [CLOSE]
   ```

   **Note**: The bot supports multiple formats. Use `[BUY]` or `LONG` for upward/bullish signals, and `[SELL]` or `SHORT` for downward/bearish signals.

### Step 5: Configure Webhook URL

1. Click the **"Notifications"** tab

2. **Enable Webhook URL**: 
   - Check the box next to **"Webhook URL"**

3. **Enter Webhook URL**: 
   - Get your bot's webhook URL from the BotMarket dashboard (bot detail page)
   - Paste it into the webhook URL field
   - Format: `https://your-api-url.com/webhook/YOUR_BOT_ID`
   
4. **Other notification options** (optional):
   - You can enable "Notify in app" or "Show toast notification" for your own alerts
   - These don't affect the bot

5. **Important**: Make sure **"Send plain text"** is **unchecked** (unless you want email notifications too)

### Step 6: Create the Alert

1. Review all settings
2. Click the **"Create"** button
3. Your alert is now active!

## Webhook URL Format

Your bot's webhook URL will look like:
```
https://your-api-url.com/webhook/bot_1234567890_abc123
```

You can find this URL on your bot's detail page in BotMarket.

## Message Format Reference

The bot accepts these message formats:

| Message | Signal Type | Action |
|---------|------------|--------|
| `LONG` or `[BUY]` or `Buy` | LONG | Buys YES outcome |
| `SHORT` or `[SELL]` or `Sell` | SHORT | Buys NO outcome |
| `CLOSE` or `[CLOSE]` | CLOSE | Exits all positions |

**Examples that work:**
- `LONG` ✅
- `[BUY]` ✅
- `Buy signal` ✅
- `SHORT` ✅
- `[SELL]` ✅
- `Sell signal` ✅
- `CLOSE` ✅
- `[CLOSE]` ✅

## Tips for Best Results

1. **Match Timeframes**: Make sure your TradingView chart timeframe matches your bot's timeframe
   - If your bot is set to 4h, use a 4h chart in TradingView

2. **Use "Once per bar close"**: This prevents duplicate signals when a condition is met multiple times

3. **Test First**: Create a test alert and use the "Send Test Signal" button on your bot to verify it works

4. **Multiple Alerts**: You can create separate alerts for LONG and SHORT signals using different indicators

5. **Webhook Secret**: If your bot has a webhook secret configured, you'll need to add it as a header:
   - Header name: `X-Webhook-Secret`
   - Value: Your bot's webhook secret

## Troubleshooting

### Alert not triggering bot
- Check that the webhook URL is correct
- Verify the message format matches one of the supported formats
- Check bot logs for incoming webhook requests
- Ensure the webhook secret matches (if configured)

### Bot receiving wrong signals
- Double-check your message format
- Make sure you're using `LONG`/`[BUY]` for buy signals and `SHORT`/`[SELL]` for sell signals

### Duplicate trades
- Change trigger to "Only once" or "Once per bar close"
- Check your bot's cooldown settings

## Example Setup

**For a Bitcoin 4-hour bot:**

1. Open BTCUSDT chart on 4h timeframe
2. Add RSI indicator
3. Create alert with:
   - Condition: RSI crossing below 30 (oversold) → Message: `[BUY]`
   - Condition: RSI crossing above 70 (overbought) → Message: `[SELL]`
4. Set interval to "Same as chart" / "4 hours"
5. Set trigger to "Once per bar close"
6. Set expiration to "Open-ended alert"
7. Add webhook URL from your bot
8. Create alert

Now your bot will automatically trade when RSI indicates oversold (buy) or overbought (sell) conditions!

