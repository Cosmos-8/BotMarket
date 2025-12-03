'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMarketplace } from '@/lib/api'

export default function MarketplacePage() {
  const [bots, setBots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('roi')

  useEffect(() => {
    loadBots()
  }, [sort])

  const loadBots = async () => {
    try {
      setLoading(true)
      const result = await getMarketplace({ sort })
      if (result.success) {
        setBots(result.data || [])
      }
    } catch (error) {
      console.error('Error loading bots:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="roi">ROI</option>
              <option value="pnl">PNL</option>
              <option value="winrate">Win Rate</option>
              <option value="created">Newest</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading bots...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No bots found in marketplace</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <Link
                key={bot.botId}
                href={`/bots/${bot.botId}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Bot {bot.botId.slice(0, 8)}...
                  </h3>
                  <p className="text-sm text-gray-500">
                    Creator: {bot.creator.slice(0, 6)}...{bot.creator.slice(-4)}
                  </p>
                </div>

                {bot.metrics ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">PNL:</span>
                      <span className={`text-sm font-medium ${bot.metrics.pnlUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${bot.metrics.pnlUsd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ROI:</span>
                      <span className={`text-sm font-medium ${bot.metrics.roiPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {bot.metrics.roiPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Win Rate:</span>
                      <span className="text-sm font-medium">{bot.metrics.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Trades:</span>
                      <span className="text-sm font-medium">{bot.metrics.trades}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No metrics yet</p>
                )}

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    {bot.forkCount || 0} forks
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

