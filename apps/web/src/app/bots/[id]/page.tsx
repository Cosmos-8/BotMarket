'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getBot, sendTestSignal, simulateFill } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const botId = params.id as string
  const [bot, setBot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [testSignal, setTestSignal] = useState('LONG')
  const [simulateData, setSimulateData] = useState({
    price: 0.5,
    size: 25,
    fees: 0.1,
  })

  useEffect(() => {
    loadBot()
  }, [botId])

  const loadBot = async () => {
    try {
      setLoading(true)
      const result = await getBot(botId)
      if (result.success) {
        setBot(result.data)
      }
    } catch (error) {
      console.error('Error loading bot:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestSignal = async () => {
    try {
      await sendTestSignal(botId, testSignal)
      alert('Test signal sent!')
      loadBot()
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleSimulateFill = async () => {
    if (!bot?.recentOrders?.[0]?.id) {
      alert('No orders found to simulate fill')
      return
    }

    try {
      await simulateFill({
        botId,
        orderId: bot.recentOrders[0].id,
        ...simulateData,
      })
      alert('Fill simulated!')
      loadBot()
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading bot...</p>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Bot not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bot Details</h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Bot ID</p>
              <p className="font-mono text-sm">{bot.botId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Creator</p>
              <p className="font-mono text-sm">{bot.creator}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Visibility</p>
              <p className="text-sm">{bot.visibility}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-sm">{new Date(bot.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {bot.metrics && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">PNL</p>
                <p className={`text-lg font-semibold ${bot.metrics.pnlUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${bot.metrics.pnlUsd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ROI</p>
                <p className={`text-lg font-semibold ${bot.metrics.roiPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {bot.metrics.roiPct.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-lg font-semibold">{bot.metrics.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trades</p>
                <p className="text-lg font-semibold">{bot.metrics.trades}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Webhook URL</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use this URL in your TradingView alert webhook settings:
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={`${API_URL}/webhook/${botId}`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
            />
            <button
              onClick={() => {
                const url = `${API_URL}/webhook/${botId}`;
                navigator.clipboard.writeText(url);
                alert('Webhook URL copied to clipboard!');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            See <a href="/tradingview-setup" className="text-blue-600 hover:underline">TradingView Setup Guide</a> for detailed instructions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Signal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signal Type
                </label>
                <select
                  value={testSignal}
                  onChange={(e) => setTestSignal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                  <option value="CLOSE">CLOSE</option>
                </select>
              </div>
              <button
                onClick={handleTestSignal}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Send Test Signal
              </button>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Simulate Fill</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simulateData.price}
                  onChange={(e) => setSimulateData({ ...simulateData, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size
                </label>
                <input
                  type="number"
                  value={simulateData.size}
                  onChange={(e) => setSimulateData({ ...simulateData, size: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={handleSimulateFill}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Simulate Fill
              </button>
            </div>
          </div>
        </div>

        {bot.recentOrders && bot.recentOrders.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Side</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bot.recentOrders.map((order: any) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.marketId.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.outcome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.side}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

