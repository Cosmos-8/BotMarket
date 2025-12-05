'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBot, sendTestSignal } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

interface BotConfig {
  version: string;
  template: string;
  market: {
    currency: string;
    timeframe: string;
  };
  webhook: {
    secret: string;
    signalMap: Record<string, any>;
  };
  sizing: {
    type: string;
    value: number;
  };
  risk: {
    maxPositionUsd: number;
    cooldownMinutes: number;
    maxTradesPerDay: number;
  };
  execution: {
    orderType: string;
    maxSlippageBps: number;
  };
}

interface BotMetrics {
  pnlUsd: number;
  roiPct: number;
  trades: number;
  winRate: number;
  maxDrawdown?: number;
}

interface Order {
  id: string;
  botId: string;
  placedAt: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  status: string;
  orderId: string;
  tokenId: string;
}

interface Bot {
  botId: string;
  creator: string;
  visibility: string;
  config: BotConfig;
  metrics?: BotMetrics;
  recentOrders?: Order[];
  forkCount?: number;
  createdAt: string;
}

type SignalType = 'LONG' | 'SHORT' | 'CLOSE';

// ============================================================================
// Helper Components
// ============================================================================

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  subValue?: string;
}

function MetricCard({ icon, label, value, valueColor = 'text-white', subValue }: MetricCardProps) {
  return (
    <div className="bg-dark-600 rounded-xl p-4 border border-white/5">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  );
}

interface SignalButtonProps {
  signal: SignalType;
  onClick: () => void;
  isLoading: boolean;
  loadingSignal: SignalType | null;
}

function SignalButton({ signal, onClick, isLoading, loadingSignal }: SignalButtonProps) {
  const isThisLoading = isLoading && loadingSignal === signal;
  
  const colors: Record<SignalType, string> = {
    LONG: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400',
    SHORT: 'bg-red-500 hover:bg-red-600 border-red-400',
    CLOSE: 'bg-amber-500 hover:bg-amber-600 border-amber-400',
  };

  const icons: Record<SignalType, string> = {
    LONG: '📈',
    SHORT: '📉',
    CLOSE: '⏹️',
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex-1 px-4 py-3 ${colors[signal]} text-white rounded-lg font-medium transition-all border-b-4 active:border-b-0 active:mt-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2`}
    >
      {isThisLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span>{icons[signal]}</span>
          <span>{signal}</span>
        </>
      )}
    </button>
  );
}

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50 animate-slide-up ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }`}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span className="text-white font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.id as string;
  
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [loadingSignal, setLoadingSignal] = useState<SignalType | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [signalHistory, setSignalHistory] = useState<Array<{ signal: SignalType; time: Date; status: string }>>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load bot data
  const loadBot = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const result = await getBot(botId);
      if (result.success) {
        setBot(result.data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error loading bot:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [botId]);

  // Initial load
  useEffect(() => {
    loadBot();
  }, [loadBot]);

  // Polling for auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBot(false); // Silent refresh
    }, 5000);
    return () => clearInterval(interval);
  }, [loadBot]);

  // Handle sending test signal
  const handleSendSignal = async (signal: SignalType) => {
    try {
      setSendingSignal(true);
      setLoadingSignal(signal);
      
      await sendTestSignal(botId, signal);
      
      // Add to signal history
      setSignalHistory(prev => [
        { signal, time: new Date(), status: 'processed' },
        ...prev.slice(0, 9), // Keep last 10
      ]);
      
      setToast({ message: `${signal} signal sent successfully!`, type: 'success' });
      
      // Refresh bot data after a short delay to allow processing
      setTimeout(() => loadBot(false), 1000);
    } catch (error: any) {
      setToast({ 
        message: error.response?.data?.error || error.message || 'Failed to send signal', 
        type: 'error' 
      });
    } finally {
      setSendingSignal(false);
      setLoadingSignal(null);
    }
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = () => {
    const url = `${API_URL}/webhook/${botId}`;
    navigator.clipboard.writeText(url);
    setToast({ message: 'Webhook URL copied!', type: 'success' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent mb-4"></div>
          <p className="text-zinc-400">Loading bot...</p>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-zinc-400 mb-4">Bot not found</p>
          <button
            onClick={() => router.back()}
            className="text-accent hover:text-accent-hover transition-colors"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const config = bot.config;
  const metrics = bot.metrics;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
            className="text-accent hover:text-accent-hover transition-colors flex items-center space-x-1"
        >
            <span>←</span>
            <span>Back to Marketplace</span>
        </button>
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>Live • Updated {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Bot Title */}
        <div className="flex items-center justify-between mb-6">
            <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {config?.market?.currency || 'Bot'} {config?.market?.timeframe || ''} Dashboard
            </h1>
            <p className="text-zinc-500 font-mono text-sm">{bot.botId}</p>
            </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            bot.visibility === 'PUBLIC' 
              ? 'bg-accent/10 text-accent border border-accent/20' 
              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
          }`}>
            {bot.visibility}
          </span>
            </div>

        {/* Polymarket Badge */}
        <div className="mb-8 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl flex items-center space-x-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xl">📊</span>
            </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded-full border border-purple-500/30">
                Polymarket-ready strategy
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Configured for Polymarket-style YES/NO markets with TradingView signals.
            </p>
          </div>
        </div>

        {/* Performance Summary Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <span>📊</span>
            <span>Performance Summary</span>
          </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon="💰"
              label="ROI"
              value={metrics ? `${metrics.roiPct >= 0 ? '+' : ''}${metrics.roiPct.toFixed(2)}%` : '0.00%'}
              valueColor={metrics && metrics.roiPct >= 0 ? 'text-emerald-400' : 'text-red-400'}
              subValue="Return on investment"
            />
            <MetricCard
              icon="💵"
              label="PnL"
              value={metrics ? `${metrics.pnlUsd >= 0 ? '+' : ''}$${metrics.pnlUsd.toFixed(2)}` : '$0.00'}
              valueColor={metrics && metrics.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}
              subValue="Profit / Loss"
            />
            <MetricCard
              icon="🎯"
              label="Win Rate"
              value={metrics ? `${metrics.winRate.toFixed(1)}%` : '0%'}
              subValue="Winning trades"
            />
            <MetricCard
              icon="📈"
              label="Trades"
              value={metrics ? metrics.trades.toString() : '0'}
              subValue="Total executed"
            />
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Send Test Signal Panel */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center space-x-2">
                <span>⚡</span>
                <span>Send Test Signal</span>
              </h2>
              <p className="text-sm text-zinc-400 mb-4">
                Send a mock trading signal to test the bot&apos;s execution pipeline.
              </p>
              <div className="flex space-x-3">
                <SignalButton
                  signal="LONG"
                  onClick={() => handleSendSignal('LONG')}
                  isLoading={sendingSignal}
                  loadingSignal={loadingSignal}
                />
                <SignalButton
                  signal="SHORT"
                  onClick={() => handleSendSignal('SHORT')}
                  isLoading={sendingSignal}
                  loadingSignal={loadingSignal}
                />
                <SignalButton
                  signal="CLOSE"
                  onClick={() => handleSendSignal('CLOSE')}
                  isLoading={sendingSignal}
                  loadingSignal={loadingSignal}
                />
              </div>
            </div>

            {/* Recent Trades Card */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>Recent Trades</span>
              </h2>
              
              {bot.recentOrders && bot.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Side</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Outcome</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Size</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bot.recentOrders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-zinc-400">
                            {new Date(order.placedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              order.side === 'BUY' 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {order.side}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              order.outcome === 'YES' 
                                ? 'bg-accent/10 text-accent border border-accent/20' 
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>
                              {order.outcome}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-300">
                            ${order.size.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-300">
                            {order.price.toFixed(4)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              order.status === 'FILLED' 
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : order.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-zinc-500/10 text-zinc-400'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-zinc-400 mb-2">No trades yet</p>
                  <p className="text-sm text-zinc-500">Send a test signal above to see trades appear here!</p>
                </div>
              )}
            </div>

            {/* Bot Configuration Panel */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <span>⚙️</span>
                <span>Bot Configuration</span>
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Market */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Market</p>
                  <p className="text-sm font-medium text-white">{config?.market?.currency || 'N/A'}</p>
                </div>
                
                {/* Timeframe */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Timeframe</p>
                  <p className="text-sm font-medium text-white">{config?.market?.timeframe || 'N/A'}</p>
                </div>
                
                {/* Sizing */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Trade Size</p>
                  <p className="text-sm font-medium text-white">
                    ${config?.sizing?.value || 0} {config?.sizing?.type === 'fixed_usd' ? '(fixed)' : '(%)'}
                </p>
              </div>
                
                {/* Max Position */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Max Position</p>
                  <p className="text-sm font-medium text-white">${config?.risk?.maxPositionUsd || 0}</p>
                </div>
                
                {/* Cooldown */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Cooldown</p>
                  <p className="text-sm font-medium text-white">{config?.risk?.cooldownMinutes || 0} min</p>
                </div>
                
                {/* Max Trades */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Max Trades/Day</p>
                  <p className="text-sm font-medium text-white">{config?.risk?.maxTradesPerDay || 0}</p>
                </div>
                
                {/* Order Type */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Order Type</p>
                  <p className="text-sm font-medium text-white capitalize">{config?.execution?.orderType || 'N/A'}</p>
                </div>
                
                {/* Slippage */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Max Slippage</p>
                  <p className="text-sm font-medium text-white">{(config?.execution?.maxSlippageBps || 0) / 100}%</p>
                </div>
                
                {/* Template */}
                <div className="bg-dark-600 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Template</p>
                  <p className="text-sm font-medium text-white truncate">{config?.template || 'N/A'}</p>
              </div>
              </div>
            </div>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Signal Activity Feed */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <span>📡</span>
                <span>Signal Activity</span>
              </h2>
              
              {signalHistory.length > 0 ? (
                <div className="space-y-2">
                  {signalHistory.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`w-2 h-2 rounded-full ${
                          entry.signal === 'LONG' ? 'bg-emerald-400' :
                          entry.signal === 'SHORT' ? 'bg-red-400' : 'bg-amber-400'
                        }`}></span>
                        <span className="text-sm font-medium text-white">{entry.signal}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">{entry.time.toLocaleTimeString()}</p>
                        <p className="text-xs text-emerald-400">{entry.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-zinc-500">No signals sent yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Send a test signal to see activity</p>
          </div>
              )}
        </div>

            {/* Webhook URL Card */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center space-x-2">
                <span>🔗</span>
                <span>Webhook URL</span>
              </h2>
              <p className="text-xs text-zinc-400 mb-3">
                Use this URL in your TradingView alert settings:
              </p>
              <div className="bg-dark-600 rounded-lg p-3 mb-3">
                <p className="text-xs font-mono text-zinc-300 break-all">
                  {API_URL}/webhook/{botId}
                </p>
              </div>
              <button
                onClick={copyWebhookUrl}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium"
              >
                📋 Copy URL
              </button>
            </div>

            {/* Bot Info Card */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <span>🤖</span>
                <span>Bot Info</span>
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Creator</span>
                  <span className="text-sm font-mono text-zinc-300">
                    {bot.creator.slice(0, 6)}...{bot.creator.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Created</span>
                  <span className="text-sm text-zinc-300">
                    {new Date(bot.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Forks</span>
                  <span className="text-sm text-zinc-300">{bot.forkCount || 0}</span>
          </div>
                {metrics?.maxDrawdown && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Max Drawdown</span>
                    <span className="text-sm text-red-400">
                      {metrics.maxDrawdown.toFixed(2)}%
                    </span>
              </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* CSS for slide up animation */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
