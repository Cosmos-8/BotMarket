'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useSignMessage } from 'wagmi';
import {
  getDashboard,
  getBalance,
  allocateToBot,
  withdrawFromBot,
  getBotBalance,
  startBot,
  stopBot,
  withdrawBalance,
} from '@/lib/api';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'ethers';
import { USDC_ADDRESS, ERC20_ABI } from '@/config/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

interface Bot {
  botId: string;
  creator: string;
  visibility: string;
  isActive: boolean;
  createdAt: string;
  walletAddress: string | null;
  allocatedBalance: number;
  metrics: {
    pnlUsd: number;
    roiPct: number;
    trades: number;
    winRate: number;
  } | null;
  config: any;
}

interface DashboardData {
  address: string;
  poolBalance: number;
  proxyWallet: {
    address: string;
    network: string;
  } | null;
  bots: Bot[];
  summary: {
    totalBots: number;
    activeBots: number;
    totalPnl: number;
    totalRoi: number;
    bestPerformingBot: {
      botId: string;
      roi: number;
      pnl: number;
    } | null;
  };
}

// ============================================================================
// Component
// ============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { address: userAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pool' | 'bots'>('pool');
  
  // Pool deposit/withdraw state
  const [poolDepositAmount, setPoolDepositAmount] = useState('');
  const [poolWithdrawAmount, setPoolWithdrawAmount] = useState('');
  const [isPoolDepositing, setIsPoolDepositing] = useState(false);
  const [isPoolWithdrawing, setIsPoolWithdrawing] = useState(false);
  
  // Bot management state
  const [botActions, setBotActions] = useState<Record<string, { type: 'allocate' | 'withdraw' | 'toggle'; amount?: string }>>({});
  
  // Copied address feedback
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // USDC transfer contract
  const {
    writeContract: transferUsdc,
    data: transferHash,
    isPending: isTransferPending,
    error: transferError,
    isError: isTransferError,
  } = useWriteContract();
  
  const {
    isLoading: isConfirming,
    isSuccess: isTransferConfirmed,
  } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    if (!userAddress) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboard(userAddress);
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    if (isConnected && userAddress) {
      loadDashboard();
    } else {
      setDashboardData(null);
      setLoading(false);
    }
  }, [isConnected, userAddress, loadDashboard]);

  // Handle pool deposit (on-chain USDC transfer)
  const handlePoolDeposit = async () => {
    if (!userAddress || !dashboardData?.proxyWallet) {
      setError('No pool wallet found. Please wait for it to be created.');
      return;
    }
    
    const amount = parseFloat(poolDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsPoolDepositing(true);
    setError(null);
    
    try {
      const amountWei = parseUnits(amount.toFixed(6), 6);
      console.log('Initiating USDC.e transfer:', {
        from: userAddress,
        to: dashboardData.proxyWallet.address,
        amount: amount,
        amountWei: amountWei.toString(),
        usdcAddress: USDC_ADDRESS,
      });
      
      transferUsdc({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [dashboardData.proxyWallet.address as `0x${string}`, amountWei],
      });
    } catch (err: any) {
      console.error('Deposit initiation error:', err);
      setError(err.message || 'Failed to initiate deposit. Check console for details.');
      setIsPoolDepositing(false);
    }
  };

  // Handle transfer confirmation
  useEffect(() => {
    if (isTransferConfirmed && transferHash) {
      // Update balance after successful transfer
      loadDashboard();
      setPoolDepositAmount('');
      setIsPoolDepositing(false);
      setError(null);
    }
  }, [isTransferConfirmed, transferHash, loadDashboard]);

  // Handle transfer errors
  useEffect(() => {
    if (isTransferError && transferError) {
      console.error('Transfer error:', transferError);
      setError(transferError.message || 'Transfer failed. Make sure you have USDC.e and POL for gas.');
      setIsPoolDepositing(false);
    }
  }, [isTransferError, transferError]);

  // Handle pool withdraw
  const handlePoolWithdraw = async () => {
    if (!userAddress) return;
    
    const amount = parseFloat(poolWithdrawAmount);
    if (isNaN(amount) || amount <= 0 || amount > (dashboardData?.poolBalance || 0)) {
      setError('Please enter a valid amount');
      return;
    }

    setIsPoolWithdrawing(true);
    setError(null);
    
    try {
      const result = await withdrawBalance(userAddress, amount, userAddress);
      if (result.success) {
        setPoolWithdrawAmount('');
        loadDashboard();
      } else {
        setError(result.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setIsPoolWithdrawing(false);
    }
  };

  // Handle bot allocation
  const handleBotAllocate = async (botId: string, amount: number) => {
    if (!userAddress) return;
    
    try {
      const result = await allocateToBot(userAddress, botId, amount);
      if (result.success) {
        loadDashboard();
        setBotActions((prev) => {
          const next = { ...prev };
          delete next[botId];
          return next;
        });
      } else {
        setError(result.error || 'Allocation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Allocation failed');
    }
  };

  // Handle bot withdraw
  const handleBotWithdraw = async (botId: string, amount: number, toPool: boolean) => {
    if (!userAddress) return;
    
    try {
      const result = await withdrawFromBot(
        userAddress,
        botId,
        amount,
        toPool ? undefined : userAddress,
        toPool
      );
      if (result.success) {
        loadDashboard();
        setBotActions((prev) => {
          const next = { ...prev };
          delete next[botId];
          return next;
        });
      } else {
        setError(result.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Withdrawal failed');
    }
  };

  // Handle bot start/stop
  const handleBotToggle = async (botId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await stopBot(botId);
      } else {
        await startBot(botId);
      }
      loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to toggle bot');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔐</div>
          <p className="text-xl text-zinc-400 mb-4">Please connect your wallet</p>
          <p className="text-sm text-zinc-500">Connect your Polygon wallet to view your dashboard</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent mb-4"></div>
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-xl text-zinc-400 mb-4">Error loading dashboard</p>
          <p className="text-sm text-zinc-500 mb-4">{error}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = dashboardData;
  
  if (!data || !data.summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent mb-4"></div>
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-zinc-400">
            Manage your trading pool and bots
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Summary Statistics */}
        {data && data.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <p className="text-xs text-zinc-500 mb-1">Total Bots</p>
              <p className="text-3xl font-bold text-white">{data.summary.totalBots}</p>
              <p className="text-xs text-zinc-500 mt-1">{data.summary.activeBots} active</p>
            </div>
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <p className="text-xs text-zinc-500 mb-1">Total PnL</p>
              <p className={`text-3xl font-bold ${data.summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.summary.totalPnl >= 0 ? '+' : ''}${data.summary.totalPnl.toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Across all bots</p>
            </div>
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <p className="text-xs text-zinc-500 mb-1">Average ROI</p>
              <p className={`text-3xl font-bold ${data.summary.totalRoi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.summary.totalRoi >= 0 ? '+' : ''}{data.summary.totalRoi.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-500 mt-1">Weighted average</p>
            </div>
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <p className="text-xs text-zinc-500 mb-1">Best Performer</p>
              {data.summary.bestPerformingBot ? (
                <>
                  <p className="text-lg font-bold text-emerald-400">
                    {data.summary.bestPerformingBot.roi.toFixed(2)}%
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {data.summary.bestPerformingBot.botId.slice(0, 20)}...
                  </p>
                </>
              ) : (
                <p className="text-lg text-zinc-500">No bots yet</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex space-x-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('pool')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'pool'
                ? 'text-accent border-b-2 border-accent'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Trading Pool
          </button>
          <button
            onClick={() => setActiveTab('bots')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'bots'
                ? 'text-accent border-b-2 border-accent'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            My Bots ({data?.bots?.length || 0})
          </button>
        </div>

        {/* Trading Pool Tab */}
        {activeTab === 'pool' && data && (
          <div className="space-y-6">
            {/* Pool Balance Card */}
            <div className="bg-dark-700 border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                <span>💰</span>
                <span>Trading Pool Balance</span>
              </h2>
              <div className="mb-6">
                <p className="text-4xl font-bold text-white mb-2">
                  ${(data.poolBalance || 0).toFixed(2)}
                </p>
                <p className="text-sm text-zinc-500">Available for allocation to bots</p>
              </div>

              {/* Deposit Section */}
              <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <h3 className="text-sm font-medium text-white mb-3">Deposit USDC</h3>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                    <input
                      type="number"
                      value={poolDepositAmount}
                      onChange={(e) => setPoolDepositAmount(e.target.value)}
                      placeholder="Amount"
                      disabled={isPoolDepositing || isTransferPending || isConfirming}
                      className="w-full pl-7 pr-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handlePoolDeposit}
                    disabled={isPoolDepositing || isTransferPending || isConfirming || !poolDepositAmount || !data.proxyWallet}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {(isPoolDepositing || isTransferPending || isConfirming) ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>📤</span>
                        <span>Deposit</span>
                      </>
                    )}
                  </button>
                </div>
                {data.proxyWallet && (
                  <p className="text-xs text-zinc-500 mt-2">
                    Deposit to: <code className="text-emerald-400">{data.proxyWallet.address.slice(0, 10)}...{data.proxyWallet.address.slice(-8)}</code>
                  </p>
                )}
              </div>

              {/* Withdraw Section */}
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                  <span>📤</span>
                  <span>Withdraw USDC to Wallet</span>
                </h3>
                {data.poolBalance === 0 ? (
                  <p className="text-sm text-zinc-500">No funds available to withdraw</p>
                ) : (
                  <>
                    <div className="flex space-x-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                        <input
                          type="number"
                          value={poolWithdrawAmount}
                          onChange={(e) => setPoolWithdrawAmount(e.target.value)}
                          placeholder="Amount"
                          disabled={isPoolWithdrawing}
                          max={data.poolBalance}
                          className="w-full pl-7 pr-4 py-3 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
                        />
                      </div>
                      <button
                        onClick={handlePoolWithdraw}
                        disabled={isPoolWithdrawing || !poolWithdrawAmount || parseFloat(poolWithdrawAmount) <= 0 || parseFloat(poolWithdrawAmount) > data.poolBalance}
                        className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isPoolWithdrawing ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>💸</span>
                            <span>Withdraw to Wallet</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex space-x-2 mt-2">
                      {[10, 25, 50, data.poolBalance].filter(amt => amt <= data.poolBalance && amt > 0).map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setPoolWithdrawAmount(amt === data.poolBalance ? data.poolBalance.toFixed(2) : amt.toString())}
                          disabled={isPoolWithdrawing}
                          className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {amt === data.poolBalance ? 'Max' : `$${amt}`}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Withdraws USDC from your trading pool to your connected wallet: <code className="text-red-400">{userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}</code>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bots Tab */}
        {activeTab === 'bots' && data && (
          <div className="space-y-4">
            {(!data.bots || data.bots.length === 0) ? (
              <div className="bg-dark-700 border border-white/5 rounded-xl p-12 text-center">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-xl text-zinc-400 mb-2">No bots yet</p>
                <p className="text-sm text-zinc-500 mb-6">Create your first bot to get started</p>
                <button
                  onClick={() => router.push('/create')}
                  className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                >
                  Create Bot
                </button>
              </div>
            ) : (
              (data.bots || []).map((bot) => {
                const action = botActions[bot.botId];
                const isAllocating = action?.type === 'allocate';
                const isWithdrawing = action?.type === 'withdraw';
                
                return (
                  <div key={bot.botId} className="bg-dark-700 border border-white/5 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{bot.botId}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            bot.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}>
                            {bot.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </div>
                        {bot.config && (
                          <p className="text-sm text-zinc-400">
                            {bot.config.market?.currency || 'Unknown'} • {bot.config.market?.timeframe || 'N/A'}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/bots/${bot.botId}`)}
                        className="px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors text-sm font-medium"
                      >
                        View Details →
                      </button>
                    </div>

                    {/* Bot Wallet Address - FUND HERE */}
                    {bot.walletAddress && (
                      <div className="mb-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-amber-400 flex items-center space-x-1">
                            <span>💰</span>
                            <span>Bot Wallet - Send USDC here to fund this bot</span>
                          </p>
                          <div className="flex space-x-2">
                            <a
                              href={`https://polygonscan.com/address/${bot.walletAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              PolygonScan ↗
                            </a>
                            <a
                              href={`https://polymarket.com/account/${bot.walletAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Polymarket ↗
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-dark-600 rounded text-sm text-amber-300 font-mono truncate">
                            {bot.walletAddress}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(bot.walletAddress || '');
                              setCopiedAddress(bot.walletAddress);
                              setTimeout(() => setCopiedAddress(null), 2000);
                            }}
                            className={`px-3 py-2 border rounded transition-colors text-sm ${
                              copiedAddress === bot.walletAddress
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            }`}
                          >
                            {copiedAddress === bot.walletAddress ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bot Metrics */}
                    {bot.metrics && (
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Balance</p>
                          <p className="text-sm font-medium text-white">${bot.allocatedBalance.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">PnL</p>
                          <p className={`text-sm font-medium ${bot.metrics.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bot.metrics.pnlUsd >= 0 ? '+' : ''}${bot.metrics.pnlUsd.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">ROI</p>
                          <p className={`text-sm font-medium ${bot.metrics.roiPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bot.metrics.roiPct >= 0 ? '+' : ''}{bot.metrics.roiPct.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Trades</p>
                          <p className="text-sm font-medium text-white">{bot.metrics.trades}</p>
                        </div>
                      </div>
                    )}

                    {/* Bot Actions */}
                    <div className="flex space-x-2">
                      {/* Start/Stop Button */}
                      <button
                        onClick={() => handleBotToggle(bot.botId, bot.isActive)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                          bot.isActive
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {bot.isActive ? '⏹️ Stop' : '▶️ Start'}
                      </button>

                      {/* Allocate Button */}
                      <button
                        onClick={() => setBotActions((prev) => ({
                          ...prev,
                          [bot.botId]: { type: 'allocate', amount: '' },
                        }))}
                        disabled={data.poolBalance === 0}
                        className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        💰 Allocate
                      </button>

                      {/* Withdraw Button */}
                      {bot.allocatedBalance > 0 && (
                        <button
                          onClick={() => setBotActions((prev) => ({
                            ...prev,
                            [bot.botId]: { type: 'withdraw', amount: '' },
                          }))}
                          className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
                        >
                          📤 Withdraw
                        </button>
                      )}

                      {/* Polymarket Profile Link */}
                      {bot.walletAddress && (
                        <a
                          href={`https://polymarket.com/account/${bot.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-medium flex items-center space-x-1"
                        >
                          <span>📊</span>
                          <span>Profile</span>
                        </a>
                      )}
                    </div>

                    {/* Allocate Modal */}
                    {action?.type === 'allocate' && (
                      <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                        <div className="flex space-x-2 mb-2">
                          <input
                            type="number"
                            value={action.amount || ''}
                            onChange={(e) => setBotActions((prev) => ({
                              ...prev,
                              [bot.botId]: { type: 'allocate', amount: e.target.value },
                            }))}
                            placeholder="Amount"
                            className="flex-1 px-3 py-2 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                          />
                          <button
                            onClick={() => {
                              const amount = parseFloat(action.amount || '0');
                              if (amount > 0 && amount <= data.poolBalance) {
                                handleBotAllocate(bot.botId, amount);
                              }
                            }}
                            disabled={isAllocating || !action.amount || parseFloat(action.amount || '0') <= 0 || parseFloat(action.amount || '0') > data.poolBalance}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAllocating ? '...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setBotActions((prev) => {
                              const next = { ...prev };
                              delete next[bot.botId];
                              return next;
                            })}
                            className="px-4 py-2 bg-dark-600 text-white rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Available: ${data.poolBalance.toFixed(2)}
                        </p>
                      </div>
                    )}

                    {/* Withdraw Modal */}
                    {action?.type === 'withdraw' && (
                      <div className="mt-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <div className="flex space-x-2 mb-2">
                          <input
                            type="number"
                            value={action.amount || ''}
                            onChange={(e) => setBotActions((prev) => ({
                              ...prev,
                              [bot.botId]: { type: 'withdraw', amount: e.target.value },
                            }))}
                            placeholder="Amount"
                            className="flex-1 px-3 py-2 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                          />
                          <button
                            onClick={() => {
                              const amount = parseFloat(action.amount || '0');
                              if (amount > 0 && amount <= bot.allocatedBalance) {
                                handleBotWithdraw(bot.botId, amount, true); // Withdraw to pool
                              }
                            }}
                            disabled={isWithdrawing || !action.amount || parseFloat(action.amount || '0') <= 0 || parseFloat(action.amount || '0') > bot.allocatedBalance}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isWithdrawing ? '...' : 'To Pool'}
                          </button>
                          <button
                            onClick={() => {
                              const amount = parseFloat(action.amount || '0');
                              if (amount > 0 && amount <= bot.allocatedBalance) {
                                handleBotWithdraw(bot.botId, amount, false); // Withdraw to wallet
                              }
                            }}
                            disabled={isWithdrawing || !action.amount || parseFloat(action.amount || '0') <= 0 || parseFloat(action.amount || '0') > bot.allocatedBalance}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isWithdrawing ? '...' : 'To Wallet'}
                          </button>
                          <button
                            onClick={() => setBotActions((prev) => {
                              const next = { ...prev };
                              delete next[bot.botId];
                              return next;
                            })}
                            className="px-4 py-2 bg-dark-600 text-white rounded-lg font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Available: ${bot.allocatedBalance.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

