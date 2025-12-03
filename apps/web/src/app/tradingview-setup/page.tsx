'use client'

import Link from 'next/link'

export default function TradingViewSetupPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back
        </Link>

        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">TradingView Alert Setup Guide</h1>

          <div className="prose max-w-none">
            <p className="text-lg text-gray-600 mb-8">
              Follow these steps to connect your TradingView alerts to your BotMarket trading bot.
            </p>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 1: Add Indicator to Your Chart</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Open TradingView and navigate to your chart</li>
                  <li>Click the <strong>"Indicators"</strong> button at the top of the screen</li>
                  <li>Search for and add your preferred indicator (e.g., RSI, MACD, Moving Averages)</li>
                  <li>Configure the indicator settings as desired</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 2: Create Alert</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Click the <strong>"Alert"</strong> button at the top of the TradingView screen (bell icon)</li>
                  <li>The "Create alert on [SYMBOL]" dialog will appear</li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 3: Configure Alert Settings</h2>
                <p className="text-gray-700 mb-4">In the <strong>Settings</strong> tab:</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div>
                    <strong className="text-gray-900">Symbols:</strong>
                    <p className="text-gray-700">Should already be set to your trading pair (e.g., BTCUSDT)</p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Condition:</strong>
                    <ul className="list-disc list-inside ml-4 text-gray-700">
                      <li>First dropdown: Select your indicator (e.g., "RSI", "MACD")</li>
                      <li>Second dropdown: Select the condition:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>For <strong>UP/BUY signals</strong>: Select "Buy" or any bullish condition</li>
                          <li>For <strong>DOWN/SELL signals</strong>: Select "Sell" or any bearish condition</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-gray-900">Interval:</strong>
                    <p className="text-gray-700">Set to <strong>"Same as chart"</strong> (this ensures the alert matches your bot's timeframe)</p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Trigger:</strong>
                    <p className="text-gray-700">Select <strong>"Only once"</strong> or <strong>"Once per bar close"</strong> (recommended)</p>
                  </div>
                  <div>
                    <strong className="text-gray-900">Expiration:</strong>
                    <p className="text-gray-700">Select <strong>"Open-ended alert"</strong></p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 4: Configure Alert Message</h2>
                <p className="text-gray-700 mb-4">Click the <strong>"Message"</strong> tab and enter one of these formats:</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="mb-4">
                    <strong className="text-gray-900">For BUY/LONG signals:</strong>
                    <div className="mt-2 space-y-1">
                      <code className="block bg-white p-2 rounded border">LONG</code>
                      <code className="block bg-white p-2 rounded border">[BUY]</code>
                      <code className="block bg-white p-2 rounded border">Buy signal</code>
                    </div>
                  </div>
                  <div className="mb-4">
                    <strong className="text-gray-900">For SELL/SHORT signals:</strong>
                    <div className="mt-2 space-y-1">
                      <code className="block bg-white p-2 rounded border">SHORT</code>
                      <code className="block bg-white p-2 rounded border">[SELL]</code>
                      <code className="block bg-white p-2 rounded border">Sell signal</code>
                    </div>
                  </div>
                  <div>
                    <strong className="text-gray-900">For CLOSE signals:</strong>
                    <div className="mt-2 space-y-1">
                      <code className="block bg-white p-2 rounded border">CLOSE</code>
                      <code className="block bg-white p-2 rounded border">[CLOSE]</code>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 5: Configure Webhook URL</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Click the <strong>"Notifications"</strong> tab</li>
                  <li>Check the box next to <strong>"Webhook URL"</strong></li>
                  <li>Get your bot's webhook URL from the bot detail page in BotMarket</li>
                  <li>Paste it into the webhook URL field</li>
                  <li>Format: <code className="bg-gray-100 px-2 py-1 rounded">https://your-api-url.com/webhook/YOUR_BOT_ID</code></li>
                </ol>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> You can find your bot's webhook URL on the bot detail page. Click "Copy" to copy it to your clipboard.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 6: Create the Alert</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Review all settings</li>
                  <li>Click the <strong>"Create"</strong> button</li>
                  <li>Your alert is now active!</li>
                </ol>
              </section>

              <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-yellow-900 mb-3">Important Tips</h2>
                <ul className="list-disc list-inside space-y-2 text-yellow-800">
                  <li><strong>Match Timeframes:</strong> Make sure your TradingView chart timeframe matches your bot's timeframe</li>
                  <li><strong>Use "Once per bar close":</strong> This prevents duplicate signals</li>
                  <li><strong>Test First:</strong> Use the "Send Test Signal" button on your bot to verify it works</li>
                  <li><strong>Multiple Alerts:</strong> You can create separate alerts for LONG and SHORT signals</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Example Setup</h2>
                <p className="text-gray-700 mb-4">For a Bitcoin 4-hour bot:</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm text-gray-700">
                  <p>1. Open BTCUSDT chart on <strong>4h</strong> timeframe</p>
                  <p>2. Add <strong>RSI</strong> indicator</p>
                  <p>3. Create two alerts:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Condition: RSI crossing below 30 (oversold) → Message: <code className="bg-white px-1 rounded">[BUY]</code></li>
                    <li>Condition: RSI crossing above 70 (overbought) → Message: <code className="bg-white px-1 rounded">[SELL]</code></li>
                  </ul>
                  <p>4. Set interval to "Same as chart" / "4 hours"</p>
                  <p>5. Set trigger to "Once per bar close"</p>
                  <p>6. Set expiration to "Open-ended alert"</p>
                  <p>7. Add webhook URL from your bot</p>
                  <p>8. Create alerts</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

