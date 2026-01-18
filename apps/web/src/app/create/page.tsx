'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBot } from '@/lib/api';
import { useWallet } from '@/hooks/useWallet';
import { useCreateBotOnChain } from '@/hooks/useCreateBotOnChain';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UsdcBalancePanel } from '@/components/UsdcBalancePanel';
import { RiskDisclaimer } from '@/components/RiskDisclaimer';
import { getTransactionUrl } from '@/config/contracts';

// ============================================================================
// On-Chain Registration Status Component
// ============================================================================

interface OnChainStatusProps {
  isRegistering: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash: `0x${string}` | undefined;
  txUrl: string | null;
  error: string | null;
  canRegister: boolean;
  unavailableReason: string | null;
}

function OnChainStatus({
  isRegistering,
  isConfirming,
  isConfirmed,
  txHash,
  txUrl,
  error,
  canRegister,
  unavailableReason,
}: OnChainStatusProps) {
  if (error) {
    return (
      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <div className="flex items-start space-x-3">
          <span className="text-amber-400 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-300">
              On-chain registration failed
            </p>
            <p className="text-sm text-amber-200/70 mt-1">
              Bot was created off-chain successfully, but on-chain registration failed: {error}
            </p>
            <p className="text-xs text-amber-200/50 mt-2">
              You can try registering on-chain later from the bot detail page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canRegister) {
    return (
      <div className="mt-4 p-4 bg-zinc-800/50 border border-white/5 rounded-lg">
        <div className="flex items-start space-x-3">
          <span className="text-zinc-400 text-lg">ℹ️</span>
          <div>
            <p className="text-sm font-medium text-zinc-300">
              On-chain registration skipped
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              {unavailableReason || 'Connect wallet to Polygon to register this bot on-chain.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isRegistering) {
    return (
      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <div>
            <p className="text-sm font-medium text-blue-300">
              Registering on Polygon...
            </p>
            <p className="text-sm text-blue-200/70 mt-1">
              Please confirm the transaction in your wallet
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isConfirming && txHash) {
    return (
      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <div>
            <p className="text-sm font-medium text-blue-300">
              Confirming transaction...
            </p>
            <p className="text-sm text-blue-200/70 mt-1">
              Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
              >
                View on PolygonScan →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isConfirmed && txHash) {
    return (
      <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <div className="flex items-start space-x-3">
          <span className="text-emerald-400 text-lg">✅</span>
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Bot registered on Polygon!
            </p>
            <p className="text-sm text-emerald-200/70 mt-1">
              Transaction confirmed on Polygon
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-flex items-center"
              >
                View on PolygonScan
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CreateBotPage() {
  const router = useRouter();
  const { address, isConnected, shortAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);
  const [createdConfig, setCreatedConfig] = useState<Record<string, any> | null>(null);
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

  // On-chain registration hook
  const {
    isRegistering,
    isConfirming,
    isConfirmed,
    txHash,
    txUrl,
    error: onChainError,
    canRegister,
    unavailableReason,
    registerOnChain,
  } = useCreateBotOnChain();

  // Trigger on-chain registration after bot is created
  useEffect(() => {
    if (createdBotId && createdConfig && canRegister && !txHash && !isRegistering) {
      registerOnChain({
        botId: createdBotId,
        config: createdConfig,
        visibility: formData.visibility,
        feeBps: 0,
      });
    }
  }, [createdBotId, createdConfig, canRegister, txHash, isRegistering, registerOnChain, formData.visibility]);

  // Navigate to bot page after on-chain registration completes or if skipped
  useEffect(() => {
    if (createdBotId) {
      // Navigate after a delay to show the status
      const shouldWait = canRegister && !isConfirmed && !onChainError;
      if (!shouldWait) {
        const timer = setTimeout(() => {
          router.push(`/bots/${createdBotId}`);
        }, isConfirmed ? 2000 : 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [createdBotId, canRegister, isConfirmed, onChainError, router]);

  // Auto-navigate after confirmation
  useEffect(() => {
    if (isConfirmed && createdBotId) {
      const timer = setTimeout(() => {
        router.push(`/bots/${createdBotId}`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, createdBotId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCreatedBotId(null);
    setCreatedConfig(null);

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

      // Step 1: Create bot via API (source of truth)
      const result = await createBot({
        config: botConfig,
        visibility: formData.visibility,
        creator: address,
      });

      if (result.success) {
        // Bot created successfully in database
        setCreatedBotId(result.data.botId);
        setCreatedConfig(botConfig);
        
        // Step 2: On-chain registration will be triggered by useEffect
        // If wallet not connected or wrong chain, user will see info message
        // and be redirected to bot page after a delay
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

  // Show success state if bot was created
  if (createdBotId) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-dark-700 border border-white/5 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Bot Created!</h2>
            <p className="text-zinc-400 mb-4">
              Your bot <code className="text-accent font-mono">{createdBotId.slice(0, 20)}...</code> has been created.
            </p>
            
            {/* On-chain registration status */}
            <OnChainStatus
              isRegistering={isRegistering}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              txHash={txHash}
              txUrl={txUrl}
              error={onChainError}
              canRegister={canRegister}
              unavailableReason={unavailableReason}
            />

            {/* Manual navigation button */}
            {(isConfirmed || onChainError || !canRegister) && (
              <button
                onClick={() => router.push(`/bots/${createdBotId}`)}
                className="mt-6 inline-flex items-center px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
              >
                View Bot Dashboard
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">Create New Bot</h1>
        <p className="text-zinc-400 mb-6">Configure your automated trading bot for Polymarket</p>
        
        {/* Risk Warning */}
        <div className="mb-8">
          <RiskDisclaimer compact />
        </div>

        {/* Wallet Connection Required */}
        {!isConnected ? (
          <div className="bg-dark-700 border border-white/5 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔗</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-zinc-400 mb-6 max-w-md mx-auto">
              Connect your wallet to create trading bots. A dedicated proxy wallet will be created 
              for your Polymarket trading on Polygon.
            </p>
            <ConnectButton />
            
            <div className="mt-8 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg text-left max-w-md mx-auto">
              <h3 className="text-sm font-medium text-purple-300 mb-2">How it works:</h3>
              <ul className="text-xs text-zinc-400 space-y-1.5">
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">1.</span>
                  <span>Connect your wallet (Polygon)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">2.</span>
                  <span>A proxy wallet is created for Polygon trading</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">3.</span>
                  <span>Create bots and fund them individually</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-purple-400">4.</span>
                  <span>Each bot trades using its dedicated funds</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Connected Status */}
            <div className="mb-6 flex items-center space-x-2 text-sm">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 mr-2 bg-emerald-400 rounded-full animate-pulse"></span>
                Connected
              </span>
              <span className="text-zinc-400">
                Creating as: <code className="font-mono text-accent">{shortAddress}</code>
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400 text-xs">
                Bot will be registered on Polygon
              </span>
            </div>

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

          {/* On-chain info */}
          {isConnected && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="text-blue-400">⛓️</span>
                <div>
                  <p className="text-sm text-blue-300 font-medium">
                    On-chain registration
                  </p>
                  <p className="text-sm text-blue-200/70 mt-1">
                    After creating, you&apos;ll be prompted to register this bot on Polygon. 
                    This creates a verifiable on-chain record of your bot.
                  </p>
                </div>
              </div>
            </div>
          )}

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
          </>
        )}
      </div>
    </div>
  );
}
