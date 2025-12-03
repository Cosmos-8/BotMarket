'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBot } from '@/lib/api';
import { useWallet } from '@/hooks/useWallet';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UsdcBalancePanel } from '@/components/UsdcBalancePanel';

export default function CreateBotPage() {
  const router = useRouter();
  const { address, isConnected, shortAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    currency: 'Bitcoin',
    timeframe: '1h',
    webhookSecret: '',
    sizingValue: 25,
    maxPositionUsd: 200,
    cooldownMinutes: 30,
    maxTradesPerDay: 12,
    visibility: 'PUBLIC',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Generate webhook secret if not provided
      const secret =
        formData.webhookSecret ||
        Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);

      const botConfig = {
        version: '1.0',
        template: 'tradingview-webhook',
        market: {
          currency: formData.currency,
          timeframe: formData.timeframe,
        },
        webhook: {
          secret: secret,
          signalMap: {
            LONG: { side: 'BUY', outcome: 'YES' },
            SHORT: { side: 'BUY', outcome: 'NO' },
            CLOSE: { action: 'EXIT' },
          },
        },
        sizing: {
          type: 'fixed_usd',
          value: formData.sizingValue,
        },
        risk: {
          maxPositionUsd: formData.maxPositionUsd,
          cooldownMinutes: formData.cooldownMinutes,
          maxTradesPerDay: formData.maxTradesPerDay,
        },
        execution: {
          orderType: 'limit',
          maxSlippageBps: 50,
        },
      };

      // Pass connected address as creator if available
      const result = await createBot({
        config: botConfig,
        visibility: formData.visibility,
        creator: address, // Will be undefined if not connected
      });

      if (result.success) {
        router.push(`/bots/${result.data.botId}`);
      } else {
        setError(result.error || 'Failed to create bot');
      }
    } catch (err: any) {
      console.error('Create bot error:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.details?.[0]?.message ||
        err.message ||
        'Network error: Could not connect to API server';
      setError(errorMessage);

      // If it's a network error, provide helpful message
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError(
          'Network error: Make sure the API server is running on http://localhost:3001'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Bot</h1>

        {/* Wallet Connection Status */}
        {isConnected ? (
          <div className="mb-4 flex items-center space-x-2 text-sm">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
              <span className="w-2 h-2 mr-1.5 bg-green-400 rounded-full"></span>
              Connected
            </span>
            <span className="text-gray-600">
              Creating as: <code className="font-mono text-blue-600">{shortAddress}</code>
            </span>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <span className="text-yellow-500 text-xl">⚠️</span>
              <div>
                <p className="text-sm text-yellow-800 font-medium">
                  Wallet not connected
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Connect your wallet to associate this bot with your address. Without a
                  wallet, the bot will be created with a placeholder address.
                </p>
                <div className="mt-3">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USDC Balance Panel */}
        <div className="mb-6">
          <UsdcBalancePanel />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow rounded-lg p-6 space-y-6"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              required
              value={formData.currency}
              onChange={(e) =>
                setFormData({ ...formData, currency: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Bitcoin">Bitcoin</option>
              <option value="Ethereum">Ethereum</option>
              <option value="Solana">Solana</option>
              <option value="XRP">XRP</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The bot will automatically discover and trade the current market for
              this currency
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeframe
            </label>
            <select
              required
              value={formData.timeframe}
              onChange={(e) =>
                setFormData({ ...formData, timeframe: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="15m">15 minutes</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              New markets are created every {formData.timeframe}. The bot will cache
              upcoming markets automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret (leave empty to auto-generate)
            </label>
            <input
              type="text"
              value={formData.webhookSecret}
              onChange={(e) =>
                setFormData({ ...formData, webhookSecret: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Auto-generated if empty"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trade Size (USD)
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.sizingValue}
              onChange={(e) =>
                setFormData({ ...formData, sizingValue: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Position (USD)
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.maxPositionUsd}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxPositionUsd: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cooldown (minutes)
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.cooldownMinutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cooldownMinutes: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Trades Per Day
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.maxTradesPerDay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxTradesPerDay: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <select
              value={formData.visibility}
              onChange={(e) =>
                setFormData({ ...formData, visibility: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Bot'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
