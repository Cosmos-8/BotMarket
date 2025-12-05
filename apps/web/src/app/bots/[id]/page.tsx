'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBot, sendTestSignal, deleteBot, getBotSignals, getBalance, allocateToBot, getBotBalance } from '@/lib/api';
import { useAccount } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Webhook URL for TradingView (can be ngrok URL for public access)
const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || API_URL;

// ============================================================================
// Live Market Data Types & Fetching
// ============================================================================

interface LiveMarketData {
  question: string;
  yesPrice: number;
  noPrice: number;
  lastUpdated: string;
  marketId: string | null;
  conditionId: string | null;
  volume24h: number;
  liquidity: number;
  endDate: string | null;
  active: boolean;
  source: 'live' | 'demo';
}

async function fetchLiveMarketData(botId: string): Promise<LiveMarketData | null> {
  try {
    const response = await fetch(`${API_URL}/polymarket/market/${botId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('[LiveMarket] Failed to fetch market data:', error);
    return null;
  }
}

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

interface ProxyWallet {
  address: string;
  network: string;
  note: string;
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
  proxyWallet?: ProxyWallet | null;
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

// Bot Funding Panel Component
interface BotFundingPanelProps {
  proxyWallet: ProxyWallet;
  botId: string;
  userAddress: string | undefined;
  onFundSuccess: () => void;
}

function BotFundingPanel({ proxyWallet, botId, userAddress, onFundSuccess }: BotFundingPanelProps) {
  const [userPoolBalance, setUserPoolBalance] = useState<number>(0);
  const [botAllocatedBalance, setBotAllocatedBalance] = useState<number>(0);
  const [allocateAmount, setAllocateAmount] = useState<string>('10');
  const [isAllocating, setIsAllocating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load user's pool balance and bot's allocated balance
  useEffect(() => {
    async function loadBalances() {
      if (!userAddress) return;
      
      try {
        // Get user's main pool balance
        const balanceResult = await getBalance(userAddress);
        if (balanceResult.success) {
          setUserPoolBalance(balanceResult.data.usdcBalance || 0);
        }
        
        // Get bot's allocated balance
        const botBalanceResult = await getBotBalance(botId);
        if (botBalanceResult.success) {
          setBotAllocatedBalance(botBalanceResult.data.allocatedBalance || 0);
        }
      } catch (err) {
        console.error('Error loading balances:', err);
      }
    }
    
    loadBalances();
  }, [userAddress, botId]);

  const handleAllocate = async () => {
    if (!userAddress) {
      setError('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(allocateAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > userPoolBalance) {
      setError(`Insufficient balance. You have $${userPoolBalance.toFixed(2)} in your pool.`);
      return;
    }

    setIsAllocating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await allocateToBot(userAddress, botId, amount);
      if (result.success) {
        setSuccess(`Allocated $${amount.toFixed(2)} to this bot!`);
        setUserPoolBalance(result.data.userBalance);
        setBotAllocatedBalance(prev => prev + amount);
        setAllocateAmount('');
        onFundSuccess();
      } else {
        setError(result.error || 'Failed to allocate funds');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to allocate funds');
    } finally {
      setIsAllocating(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(proxyWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${proxyWallet.address.slice(0, 6)}...${proxyWallet.address.slice(-4)}`;

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-purple-500/10 border border-emerald-500/20 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">💰</span>
          <div>
            <h3 className="text-sm font-medium text-white">Fund This Bot</h3>
            <p className="text-xs text-zinc-400">Allocate USDC from your pool</p>
          </div>
        </div>
        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
          Polygon
        </span>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dark-700/60 rounded-lg p-3">
          <p className="text-xs text-zinc-500 mb-1">Your Pool Balance</p>
          <p className="text-lg font-bold text-white">${userPoolBalance.toFixed(2)}</p>
          <p className="text-[10px] text-zinc-500">Available to allocate</p>
        </div>
        <div className="bg-dark-700/60 rounded-lg p-3">
          <p className="text-xs text-zinc-500 mb-1">Bot Allocated</p>
          <p className="text-lg font-bold text-emerald-400">${botAllocatedBalance.toFixed(2)}</p>
          <p className="text-[10px] text-zinc-500">Ready to trade</p>
        </div>
      </div>

      {/* Allocation Input */}
      {userAddress ? (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(e.target.value)}
                placeholder="Amount"
                className="w-full pl-7 pr-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              onClick={handleAllocate}
              disabled={isAllocating || userPoolBalance === 0}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isAllocating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>📤</span>
                  <span>Allocate</span>
                </>
              )}
            </button>
          </div>

          {/* Quick amounts */}
          <div className="flex space-x-2">
            {[5, 10, 25, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setAllocateAmount(amt.toString())}
                disabled={amt > userPoolBalance}
                className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setAllocateAmount(userPoolBalance.toString())}
              disabled={userPoolBalance === 0}
              className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Max
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
              {success}
            </div>
          )}

          {/* No balance warning */}
          {userPoolBalance === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 mb-1">💡 Your pool is empty</p>
              <p className="text-[10px] text-zinc-400">
                Add funds to your main pool first via the CCTP bridge on the home page, then allocate to bots.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-dark-700/60 rounded-lg text-center">
          <p className="text-sm text-zinc-400">Connect your wallet to allocate funds</p>
        </div>
      )}

      {/* Advanced: Direct Deposit (collapsed by default) */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center space-x-1"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          <span>Advanced: Direct Deposit to Bot Wallet</span>
        </button>
        
        {showAdvanced && (
          <div className="mt-3 p-3 bg-dark-700/60 rounded-lg space-y-2">
            <p className="text-[10px] text-zinc-500">
              For advanced users: Send USDC directly to this bot&apos;s wallet on Polygon
            </p>
            <div className="flex items-center justify-between bg-dark-600 rounded-lg p-2">
              <code className="text-xs text-emerald-300 font-mono">{shortAddress}</code>
              <button
                onClick={copyAddress}
                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] rounded transition"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
            <a
              href={`https://polygonscan.com/address/${proxyWallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[10px] text-purple-400 hover:text-purple-300 transition"
            >
              View on PolygonScan ↗
            </a>
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] text-zinc-500 text-center">
        Each bot has its own isolated wallet for fund management
      </p>
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
// Live Market Card Component
// ============================================================================

interface LiveMarketCardProps {
  marketData: LiveMarketData | null;
  isLoading: boolean;
  isError: boolean;
}

function LiveMarketCard({ marketData, isLoading, isError }: LiveMarketCardProps) {
  // Format relative time
  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return date.toLocaleDateString();
  }

  // Format end date
  function formatEndDate(isoString: string | null): string {
    if (!isoString) return 'TBD';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-dark-700 border border-white/5 rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-lg">📊</span>
          <span className="text-lg font-semibold text-white">Live Polymarket Market</span>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-dark-600 rounded w-3/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-dark-600 rounded"></div>
            <div className="h-16 bg-dark-600 rounded"></div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-4 text-center">
          Fetching live market data…
        </p>
      </div>
    );
  }

  // Error state
  if (isError || !marketData) {
    return (
      <div className="bg-dark-700 border border-amber-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-lg">📊</span>
          <span className="text-lg font-semibold text-white">Live Polymarket Market</span>
        </div>
        <div className="flex items-center space-x-2 text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <span>⚠️</span>
          <span className="text-sm">Unable to load live Polymarket data. Demo will continue with cached metrics.</span>
        </div>
      </div>
    );
  }

  // Success state with market data
  return (
    <div className="bg-dark-700 border border-white/5 rounded-xl p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📊</span>
          <span className="text-lg font-semibold text-white">Live Polymarket Market</span>
          {marketData.source === 'live' ? (
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
              LIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
              DEMO
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          Updated {formatRelativeTime(marketData.lastUpdated)}
        </span>
      </div>
      
      {/* Subtitle */}
      <p className="text-xs text-zinc-500 mb-4">
        Fetched in real-time via Polymarket&apos;s Gamma API
      </p>

      {/* Market Question */}
      <div className="bg-dark-600 rounded-lg p-4 mb-4">
        <p className="text-sm text-zinc-300 font-medium leading-relaxed">
          {marketData.question}
        </p>
        {marketData.endDate && (
          <p className="text-xs text-zinc-500 mt-2">
            Resolves: {formatEndDate(marketData.endDate)}
          </p>
        )}
      </div>

      {/* YES/NO Prices */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
          <p className="text-xs text-emerald-400 uppercase tracking-wide mb-1">YES</p>
          <p className="text-3xl font-bold text-emerald-400">{marketData.yesPrice}%</p>
          <p className="text-xs text-emerald-400/60 mt-1">
            ${((marketData.yesPrice / 100) * 1).toFixed(2)} per share
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <p className="text-xs text-red-400 uppercase tracking-wide mb-1">NO</p>
          <p className="text-3xl font-bold text-red-400">{marketData.noPrice}%</p>
          <p className="text-xs text-red-400/60 mt-1">
            ${((marketData.noPrice / 100) * 1).toFixed(2)} per share
          </p>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-600 rounded-lg p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">24h Volume</p>
          <p className="text-sm font-medium text-white">
            ${marketData.volume24h >= 1000 
              ? `${(marketData.volume24h / 1000).toFixed(1)}k` 
              : marketData.volume24h.toFixed(0)}
          </p>
        </div>
        <div className="bg-dark-600 rounded-lg p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">Liquidity</p>
          <p className="text-sm font-medium text-white">
            ${marketData.liquidity >= 1000 
              ? `${(marketData.liquidity / 1000).toFixed(1)}k` 
              : marketData.liquidity.toFixed(0)}
          </p>
        </div>
        <div className="bg-dark-600 rounded-lg p-3 text-center">
          <p className="text-xs text-zinc-500 mb-1">Status</p>
          <p className={`text-sm font-medium ${marketData.active ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {marketData.active ? '● Active' : '○ Closed'}
          </p>
        </div>
      </div>

      {/* Market ID (if available) */}
      {marketData.marketId && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-zinc-500">
            Market ID: <span className="font-mono text-zinc-400">{marketData.marketId.slice(0, 12)}...</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const botId = params.id as string;
  
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingSignal, setSendingSignal] = useState(false);
  const [loadingSignal, setLoadingSignal] = useState<SignalType | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [signalHistory, setSignalHistory] = useState<Array<{ signal: SignalType; time: Date; status: string }>>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Live market data state
  const [marketData, setMarketData] = useState<LiveMarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  
  // Delete bot state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Load signals from API
  const loadSignals = useCallback(async () => {
    try {
      const result = await getBotSignals(botId, 20);
      if (result.success && result.data) {
        const apiSignals = result.data.map((s: any) => ({
          signal: s.signalType as SignalType,
          time: new Date(s.receivedAt),
          status: 'processed',
        }));
        setSignalHistory(apiSignals);
      }
    } catch (error) {
      console.error('Error loading signals:', error);
    }
  }, [botId]);

  // Initial load
  useEffect(() => {
    loadBot();
    loadSignals();
  }, [loadBot, loadSignals]);

  // Polling for auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadBot(false); // Silent refresh
      loadSignals(); // Also refresh signals
    }, 5000);
    return () => clearInterval(interval);
  }, [loadBot, loadSignals]);

  // Load live market data
  const loadMarketData = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(false);
    try {
      const data = await fetchLiveMarketData(botId);
      if (data) {
        setMarketData(data);
      } else {
        setMarketError(true);
      }
    } catch {
      setMarketError(true);
    } finally {
      setMarketLoading(false);
    }
  }, [botId]);

  // Initial market data load
  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  // Refresh market data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadMarketData();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadMarketData]);

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
      
      // Refresh bot data and signals after a short delay to allow processing
      setTimeout(() => {
        loadBot(false);
        loadSignals();
      }, 1000);
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
    const url = `${WEBHOOK_BASE_URL}/webhook/${botId}`;
    navigator.clipboard.writeText(url);
    setToast({ message: 'Webhook URL copied!', type: 'success' });
  };

  // Handle delete bot
  const handleDeleteBot = async () => {
    try {
      setDeleting(true);
      await deleteBot(botId);
      setToast({ message: 'Bot deleted successfully!', type: 'success' });
      // Redirect to marketplace after deletion
      setTimeout(() => router.push('/marketplace'), 1000);
    } catch (error: any) {
      setToast({
        message: error.response?.data?.error || 'Failed to delete bot',
        type: 'error',
      });
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
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

        {/* Bot Funding Section */}
        {bot.proxyWallet && (
          <div className="mb-8">
            <BotFundingPanel 
              proxyWallet={bot.proxyWallet} 
              botId={bot.botId}
              userAddress={userAddress}
              onFundSuccess={() => loadBot(false)}
            />
          </div>
        )}

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

        {/* Live Polymarket Market Section */}
        <LiveMarketCard 
          marketData={marketData}
          isLoading={marketLoading}
          isError={marketError}
        />

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
                  {WEBHOOK_BASE_URL}/webhook/{botId}
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
              
              {/* Delete Bot Button */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
                >
                  🗑️ Delete Bot
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-dark-700 border border-white/10 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Bot?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              This will permanently delete <span className="text-white font-mono">{botId}</span> and all its trade history, signals, and metrics. This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-dark-600 text-white rounded-lg hover:bg-dark-500 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBot}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  '🗑️ Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
