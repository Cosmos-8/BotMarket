'use client';

/**
 * USDC Balance Panel Component
 * 
 * Full CCTP integration for depositing/withdrawing USDC:
 * 1. User deposits USDC on Base
 * 2. Platform bridges via CCTP to Polygon
 * 3. User can trade on Polymarket
 * 4. User withdraws back to Base
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// USDC ABI for approve and transfer
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ============================================================================
// Types
// ============================================================================

interface BridgeConfig {
  base: { chainId: number; usdc: string };
  polygon: { chainId: number; usdc: string };
  platformWallet: string | null;
  minDeposit: number;
}

interface Balances {
  base: { balance: number };
  polygon: { balance: number; proxyAddress: string | null };
  pending: { deposits: number; withdrawals: number };
}

interface BridgeTransaction {
  id: string;
  amount: number;
  direction: string;
  status: string;
  createdAt: string;
}

// ============================================================================
// USDC Icon Component
// ============================================================================

function UsdcIcon({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-5 h-5 text-[8px]' : 'w-10 h-10 text-xs';
  return (
    <div className={`${sizeClasses} rounded-full bg-[#2775CA] flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-white">$</span>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function UsdcBalancePanel() {
  const { isConnected } = useWallet();
  const { address } = useAccount();
  
  // State
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [pendingTxs, setPendingTxs] = useState<BridgeTransaction[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [depositStep, setDepositStep] = useState<'idle' | 'approving' | 'transferring' | 'bridging'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Contract write hooks
  const { writeContract: approveUsdc, data: approveHash } = useWriteContract();
  const { writeContract: transferUsdc, data: transferHash } = useWriteContract();
  
  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  
  const { isLoading: isTransferring, isSuccess: transferSuccess } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  // Load bridge config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`${API_URL}/bridge/config`);
        const data = await res.json();
        if (data.success) {
          setBridgeConfig(data.data);
        }
      } catch (err) {
        console.error('Error loading bridge config:', err);
      }
    }
    loadConfig();
  }, []);

  // Load balances
  const loadBalances = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/bridge/balance/${address}`);
      const data = await res.json();
      if (data.success) {
        setBalances(data.data);
      }
    } catch (err) {
      console.error('Error loading balances:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Load pending transactions
  const loadPendingTxs = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_URL}/bridge/history/${address}?limit=5`);
      const data = await res.json();
      if (data.success) {
        setPendingTxs(data.data.filter((tx: BridgeTransaction) => 
          !['completed', 'failed'].includes(tx.status)
        ));
      }
    } catch (err) {
      console.error('Error loading pending txs:', err);
    }
  }, [address]);

  useEffect(() => {
    loadBalances();
    loadPendingTxs();
  }, [loadBalances, loadPendingTxs]);

  // Poll for updates when there are pending transactions
  useEffect(() => {
    if (pendingTxs.length > 0) {
      const interval = setInterval(() => {
        loadBalances();
        loadPendingTxs();
      }, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }
  }, [pendingTxs.length, loadBalances, loadPendingTxs]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!address || !bridgeConfig?.platformWallet || !depositAmount) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Minimum deposit is 1 USDC');
      return;
    }

    if (balances && amount > balances.base.balance) {
      setError(`Insufficient balance. You have ${balances.base.balance.toFixed(2)} USDC on Base.`);
      return;
    }

    setIsDepositing(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Create deposit request
      const createRes = await fetch(`${API_URL}/bridge/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount }),
      });
      const createData = await createRes.json();
      
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create deposit');
      }

      const bridgeId = createData.data.bridgeId;
      const amountWei = parseUnits(amount.toString(), 6);

      // Step 2: Approve USDC
      setDepositStep('approving');
      approveUsdc({
        address: bridgeConfig.base.usdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [bridgeConfig.platformWallet as `0x${string}`, amountWei],
      });

    } catch (err: any) {
      setError(err.message || 'Deposit failed');
      setIsDepositing(false);
      setDepositStep('idle');
    }
  };

  // Handle approve success - proceed to transfer
  useEffect(() => {
    if (approveSuccess && depositStep === 'approving' && bridgeConfig?.platformWallet) {
      setDepositStep('transferring');
      const amount = parseFloat(depositAmount);
      const amountWei = parseUnits(amount.toString(), 6);
      
      transferUsdc({
        address: bridgeConfig.base.usdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [bridgeConfig.platformWallet as `0x${string}`, amountWei],
      });
    }
  }, [approveSuccess, depositStep, bridgeConfig, depositAmount, transferUsdc]);

  // Handle transfer success - confirm deposit
  useEffect(() => {
    if (transferSuccess && depositStep === 'transferring' && transferHash) {
      setDepositStep('bridging');
      
      // Confirm deposit with API
      (async () => {
        try {
          // Get the latest bridge ID from pending txs or create new
          const res = await fetch(`${API_URL}/bridge/history/${address}?limit=1`);
          const data = await res.json();
          const latestTx = data.data?.[0];
          
          if (latestTx && latestTx.status === 'pending') {
            await fetch(`${API_URL}/bridge/deposit/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                bridgeId: latestTx.id, 
                txHash: transferHash 
              }),
            });
          }
          
          setSuccess(`Deposit initiated! Your ${depositAmount} USDC is being bridged to Polygon. This takes ~10-15 minutes.`);
          setDepositAmount('');
          loadBalances();
          loadPendingTxs();
        } catch (err) {
          console.error('Error confirming deposit:', err);
        } finally {
          setIsDepositing(false);
          setDepositStep('idle');
        }
      })();
    }
  }, [transferSuccess, depositStep, transferHash, address, depositAmount, loadBalances, loadPendingTxs]);

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Minimum withdrawal is 1 USDC');
      return;
    }

    if (balances && amount > balances.polygon.balance) {
      setError(`Insufficient balance. You have ${balances.polygon.balance.toFixed(2)} USDC on Polygon.`);
      return;
    }

    setIsWithdrawing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_URL}/bridge/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount }),
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate withdrawal');
      }

      setSuccess(`Withdrawal initiated! Your ${amount} USDC is being bridged to Base. This takes ~10-15 minutes.`);
      setWithdrawAmount('');
      loadBalances();
      loadPendingTxs();
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
        <div className="flex items-center space-x-3 mb-4">
          <UsdcIcon />
          <div className="flex-1">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <p className="text-xs text-zinc-500">Connect wallet to deposit and trade</p>
          </div>
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Loading state
  if (isLoading && !balances) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
        <div className="flex items-center space-x-3 mb-4">
          <UsdcIcon />
          <div className="flex-1">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <p className="text-xs text-zinc-500">Loading balances...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-dark-600 rounded-xl"></div>
          <div className="h-20 bg-dark-600 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <UsdcIcon />
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <span className="px-1.5 py-0.5 bg-[#2775CA]/20 text-[#2775CA] text-[10px] font-medium rounded">
              CCTP Bridge
            </span>
          </div>
          <p className="text-xs text-zinc-500">Deposit from Base, trade on Polygon</p>
        </div>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Base Balance */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Base</span>
            <span className="text-[10px] text-blue-400">Source</span>
          </div>
          <p className="text-xl font-bold text-white">
            {balances?.base.balance.toFixed(2) || '0.00'}
            <span className="text-sm text-zinc-500 ml-1">USDC</span>
          </p>
        </div>

        {/* Polygon Balance */}
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Polygon</span>
            <span className="text-[10px] text-emerald-400">Trading</span>
          </div>
          <p className="text-xl font-bold text-white">
            {balances?.polygon.balance.toFixed(2) || '0.00'}
            <span className="text-sm text-zinc-500 ml-1">USDC</span>
          </p>
        </div>
      </div>

      {/* Pending Transactions */}
      {pendingTxs.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-amber-400 font-medium">Bridging in Progress</span>
          </div>
          {pendingTxs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {tx.direction === 'deposit' ? 'Deposit' : 'Withdrawal'}: ${tx.amount}
              </span>
              <span className="text-amber-400 capitalize">{tx.status}</span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-500 mt-2">
            CCTP bridges take ~10-15 minutes. Balances update automatically.
          </p>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* Deposit Section */}
      <div className="mb-4 p-4 bg-dark-700/60 border border-white/5 rounded-xl">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
          <span>📥</span>
          <span>Deposit (Base → Polygon)</span>
        </h4>
        
        <div className="flex space-x-2 mb-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              disabled={isDepositing}
              className="w-full pl-7 pr-4 py-2.5 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !depositAmount || !bridgeConfig?.platformWallet}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDepositing ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>
                  {depositStep === 'approving' && 'Approving...'}
                  {depositStep === 'transferring' && 'Transferring...'}
                  {depositStep === 'bridging' && 'Bridging...'}
                </span>
              </span>
            ) : (
              'Deposit'
            )}
          </button>
        </div>

        {/* Quick amounts */}
        <div className="flex space-x-2">
          {[10, 25, 50, 100].map((amt) => (
            <button
              key={amt}
              onClick={() => setDepositAmount(amt.toString())}
              disabled={isDepositing || (balances?.base.balance || 0) < amt}
              className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ${amt}
            </button>
          ))}
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="mb-4 p-4 bg-dark-700/60 border border-white/5 rounded-xl">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
          <span>📤</span>
          <span>Withdraw (Polygon → Base)</span>
        </h4>
        
        <div className="flex space-x-2 mb-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount"
              disabled={isWithdrawing}
              className="w-full pl-7 pr-4 py-2.5 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !withdrawAmount || (balances?.polygon.balance || 0) === 0}
            className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWithdrawing ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </span>
            ) : (
              'Withdraw'
            )}
          </button>
        </div>

        {/* Quick amounts */}
        <div className="flex space-x-2">
          {[10, 25, 50].map((amt) => (
            <button
              key={amt}
              onClick={() => setWithdrawAmount(amt.toString())}
              disabled={isWithdrawing || (balances?.polygon.balance || 0) < amt}
              className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ${amt}
            </button>
          ))}
          <button
            onClick={() => setWithdrawAmount((balances?.polygon.balance || 0).toString())}
            disabled={isWithdrawing || (balances?.polygon.balance || 0) === 0}
            className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Max
          </button>
        </div>
      </div>

      {/* Proxy Wallet Info */}
      {balances?.polygon.proxyAddress && (
        <div className="mb-4 p-3 bg-dark-700/40 rounded-lg">
          <p className="text-[10px] text-zinc-500 mb-1">Your Polygon Trading Wallet</p>
          <div className="flex items-center justify-between">
            <code className="text-xs text-purple-300 font-mono">
              {balances.polygon.proxyAddress.slice(0, 10)}...{balances.polygon.proxyAddress.slice(-8)}
            </code>
            <a
              href={`https://polygonscan.com/address/${balances.polygon.proxyAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-purple-400 hover:text-purple-300"
            >
              View ↗
            </a>
          </div>
        </div>
      )}

      {/* CCTP Info */}
      <div className="pt-3 border-t border-emerald-500/10">
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          <span className="text-emerald-400">🔗</span>{' '}
          Powered by <span className="text-zinc-400 font-medium">Circle CCTP</span> - 
          Native USDC bridging between Base and Polygon. Transfers typically complete in 10-15 minutes.
        </p>
      </div>
    </div>
  );
}

export default UsdcBalancePanel;
