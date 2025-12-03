'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMarketplace } from '@/lib/api';
import {
  BOT_REGISTRY_ADDRESS,
  getContractUrl,
  isContractsConfigured,
  formatAddress,
} from '@/config/contracts';
import { UsdcBalancePanel } from '@/components/UsdcBalancePanel';

export default function MarketplacePage() {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('roi');

  useEffect(() => {
    loadBots();
  }, [sort]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const result = await getMarketplace({ sort });
      if (result.success) {
        setBots(result.data || []);
      }
    } catch (error) {
      console.error('Error loading bots:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-gray-600 mt-1">
              Browse and fork top-performing trading bots
            </p>
          </div>
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

        {/* Info Banners Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Contract Info Banner */}
          {isContractsConfigured() && BOT_REGISTRY_ADDRESS && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">⛓️</span>
                <span className="text-sm text-blue-800">
                  BotRegistry on Base Sepolia:{' '}
                  <code className="font-mono">{formatAddress(BOT_REGISTRY_ADDRESS)}</code>
                </span>
              </div>
              <a
                href={getContractUrl(BOT_REGISTRY_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View on BaseScan ↗
              </a>
            </div>
          )}
          
          {/* USDC Balance Panel */}
          <UsdcBalancePanel />
        </div>

        {/* Bot Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-gray-600 mt-4">Loading bots...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-gray-600 mb-4">No bots found in marketplace</p>
            <Link
              href="/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create the first bot →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <Link
                key={bot.botId}
                href={`/bots/${bot.botId}`}
                className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-blue-200 transition group"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition">
                      Bot {bot.botId.slice(0, 8)}...
                    </h3>
                    {bot.metrics && bot.metrics.roiPct > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Profitable
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Creator: {bot.creator.slice(0, 6)}...{bot.creator.slice(-4)}
                  </p>
                </div>

                {bot.metrics ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">PNL:</span>
                      <span
                        className={`text-sm font-medium ${
                          bot.metrics.pnlUsd >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {bot.metrics.pnlUsd >= 0 ? '+' : ''}${bot.metrics.pnlUsd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ROI:</span>
                      <span
                        className={`text-sm font-medium ${
                          bot.metrics.roiPct >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {bot.metrics.roiPct >= 0 ? '+' : ''}{bot.metrics.roiPct.toFixed(2)}%
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
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-500">No metrics yet</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <p className="text-xs text-gray-500">{bot.forkCount || 0} forks</p>
                  <span className="text-xs text-blue-600 group-hover:underline">
                    View details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
