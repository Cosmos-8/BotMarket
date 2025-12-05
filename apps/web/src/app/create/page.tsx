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

      const result = await createBot({
        config: botConfig,
        visibility: formData.visibility,
        creator: address,
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
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">Create New Bot</h1>
        <p className="text-zinc-400 mb-8">Configure your automated trading bot for Polymarket</p>

        {/* Wallet Connection Status */}
        {isConnected ? (
          <div className="mb-6 flex items-center space-x-2 text-sm">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 mr-2 bg-emerald-400 rounded-full animate-pulse"></span>
              Connected
            </span>
            <span className="text-zinc-400">
              Creating as: <code className="font-mono text-accent">{shortAddress}</code>
            </span>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start space-x-3">
              <span className="text-amber-400 text-xl">⚠️</span>
              <div>
                <p className="text-sm text-amber-300 font-medium">
                  Wallet not connected
                </p>
                <p className="text-sm text-amber-200/70 mt-1">
                  Connect your wallet to associate this bot with your address.
                </p>
                <div className="mt-3">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USDC Balance Panel */}
        <div className="mb-8">
          <UsdcBalancePanel />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-dark-700 border border-white/5 rounded-xl p-6 space-y-6"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Market Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
              Currency
            </label>
            <select
              required
              value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            >
              <option value="Bitcoin">Bitcoin</option>
              <option value="Ethereum">Ethereum</option>
              <option value="Solana">Solana</option>
              <option value="XRP">XRP</option>
            </select>
              <p className="mt-1.5 text-xs text-zinc-500">
                Auto-discovers the current Polymarket for this currency
            </p>
          </div>

          <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
              Timeframe
            </label>
            <select
              required
              value={formData.timeframe}
                onChange={(e) =>
                  setFormData({ ...formData, timeframe: e.target.value })
                }
                className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            >
              <option value="15m">15 minutes</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
            </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Webhook Secret (leave empty to auto-generate)
            </label>
            <input
              type="text"
              value={formData.webhookSecret}
              onChange={(e) =>
                setFormData({ ...formData, webhookSecret: e.target.value })
              }
              className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              placeholder="Auto-generated if empty"
            />
          </div>

          {/* Risk Settings */}
          <div className="border-t border-white/5 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                  className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                  className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                  className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
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
                  className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Visibility
            </label>
            <select
              value={formData.visibility}
              onChange={(e) =>
                setFormData({ ...formData, visibility: e.target.value })
              }
              className="w-full px-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            >
              <option value="PUBLIC">Public (visible in marketplace)</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : '🤖 Create Bot'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-white/5 border border-white/10 text-zinc-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
