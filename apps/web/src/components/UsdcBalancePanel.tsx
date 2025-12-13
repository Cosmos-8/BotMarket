'use client';

/**
 * USDC Balance Panel Component
 * 
 * Direct USDC deposits on Polygon:
 * 1. User connects wallet on Polygon
 * 2. User deposits USDC directly to their proxy wallet
 * 3. User can allocate to bots for trading
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useOnchainUsdcBalance } from '@/hooks/useOnchainUsdcBalance';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { USDC_ADDRESS, ERC20_ABI } from '@/config/contracts';
import { getBalance, fundBalance, withdrawBalance } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  const { isConnected, isCorrectChain } = useWallet();
  const { address } = useAccount();
  const { onchainBalance, refetch: refetchOnchainBalance } = useOnchainUsdcBalance();
  
  // State
  const [proxyWallet, setProxyWallet] = useState<{ address: string; isNew: boolean } | null>(null);
  const [poolBalance, setPoolBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Contract write hook for USDC transfer
  const { 
    writeContract: transferUsdc, 
    data: transferHash, 
    error: transferError,
    isPending: isTransferPending,
    reset: resetTransfer 
  } = useWriteContract();
  
  const { 
    isLoading: isConfirming, 
    isSuccess: isTransferConfirmed,
  } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  // Load user's proxy wallet and pool balance
  const loadBalances = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const result = await getBalance(address);
      if (result.success) {
        setPoolBalance(result.data.usdcBalance || 0);
        if (result.data.proxyWallet) {
          setProxyWallet(result.data.proxyWallet);
        }
      }
    } catch (err) {
      console.error('Error loading balances:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Handle transfer errors
  useEffect(() => {
    if (transferError) {
      console.error('Transfer error:', transferError);
      setError(
        (transferError as any).shortMessage || 
        (transferError.message.includes('User rejected') 
          ? 'Transaction cancelled' 
          : `Transfer failed: ${transferError.message.slice(0, 100)}`)
      );
      setIsDepositing(false);
      resetTransfer();
    }
  }, [transferError, resetTransfer]);

  // Handle transfer success - update backend balance
  useEffect(() => {
    if (isTransferConfirmed && transferHash && isDepositing) {
      const amount = parseFloat(depositAmount);
      
      // Update backend with the deposit
      (async () => {
        try {
          await fundBalance(address!, amount);
          setSuccess(`Successfully deposited ${amount} USDC to your trading pool!`);
          setDepositAmount('');
          loadBalances();
          refetchOnchainBalance();
        } catch (err) {
          console.error('Error updating backend:', err);
          setError('Deposit confirmed but failed to update balance. Please refresh.');
        } finally {
          setIsDepositing(false);
          resetTransfer();
        }
      })();
    }
  }, [isTransferConfirmed, transferHash, isDepositing, depositAmount, address, loadBalances, refetchOnchainBalance, resetTransfer]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!address || !proxyWallet) {
      setError('Please connect your wallet');
      return;
    }
    
    if (!depositAmount) {
      setError('Please enter an amount');
      return;
    }
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Minimum deposit is 1 USDC');
      return;
    }

    const walletBalance = parseFloat(onchainBalance);
    if (walletBalance < amount) {
      setError(`Insufficient USDC. You have ${onchainBalance} USDC in your wallet.`);
      return;
    }

    setIsDepositing(true);
    setError(null);
    setSuccess(null);

    try {
      const amountWei = parseUnits(amount.toString(), 6);
      
      // Transfer USDC to proxy wallet
      transferUsdc({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [proxyWallet.address as `0x${string}`, amountWei],
      });
    } catch (err: any) {
      console.error('Deposit error:', err);
      setError(err.message || 'Deposit failed');
      setIsDepositing(false);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
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

  // Wrong chain state
  if (!isCorrectChain) {
    return (
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-center space-x-3 mb-4">
          <UsdcIcon />
          <div className="flex-1">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <p className="text-xs text-amber-400">Please switch to Polygon network</p>
          </div>
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Loading state
  if (isLoading && !proxyWallet) {
    return (
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
        <div className="flex items-center space-x-3 mb-4">
          <UsdcIcon />
          <div className="flex-1">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <p className="text-xs text-zinc-500">Loading balances...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-dark-600 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const isProcessing = isDepositing || isTransferPending || isConfirming;

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <UsdcIcon />
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-white">USDC Trading Pool</h3>
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded">
              Polygon
            </span>
          </div>
          <p className="text-xs text-zinc-500">Deposit USDC to fund your bots</p>
        </div>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Wallet Balance */}
        <div className="p-4 bg-dark-700/60 border border-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Wallet</span>
            <span className="text-[10px] text-zinc-500">On-chain</span>
          </div>
          <p className="text-xl font-bold text-white">
            {onchainBalance}
            <span className="text-sm text-zinc-500 ml-1">USDC</span>
          </p>
        </div>

        {/* Pool Balance */}
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Trading Pool</span>
            <span className="text-[10px] text-emerald-400">Ready</span>
          </div>
          <p className="text-xl font-bold text-white">
            {poolBalance.toFixed(2)}
            <span className="text-sm text-zinc-500 ml-1">USDC</span>
          </p>
        </div>
      </div>

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
          <span>Deposit USDC</span>
        </h4>
        
        <div className="flex space-x-2 mb-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              disabled={isProcessing}
              className="w-full pl-7 pr-4 py-2.5 bg-dark-600 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={isProcessing || !depositAmount || !proxyWallet}
            className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isConfirming ? 'Confirming...' : 'Depositing...'}</span>
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
              disabled={isProcessing || parseFloat(onchainBalance) < amt}
              className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ${amt}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-zinc-500 mt-3">
          Transfer USDC from your wallet to your trading pool. From there, allocate to individual bots.
        </p>
      </div>

      {/* Withdrawal Section */}
      {poolBalance > 0 && (
        <div className="mb-4 p-4 bg-dark-700/60 border border-white/5 rounded-xl">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
            <span>📤</span>
            <span>Withdraw USDC</span>
          </h4>
          
          <div className="flex space-x-2 mb-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount"
                disabled={isProcessing || isWithdrawing}
                className="w-full pl-8 pr-3 py-2 bg-dark-600 border border-white/5 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
              />
            </div>
            <button
              onClick={async () => {
                if (!address || !withdrawAmount) return;
                const amount = parseFloat(withdrawAmount);
                if (amount <= 0 || amount > poolBalance) {
                  setError(`Invalid amount. Max: $${poolBalance.toFixed(2)}`);
                  return;
                }
                setIsWithdrawing(true);
                setError(null);
                setSuccess(null);
                try {
                  const result = await withdrawBalance(address, amount, address);
                  if (result.success) {
                    setSuccess(`Successfully withdrew ${amount} USDC! TX: ${result.data.txHash.slice(0, 10)}...`);
                    setWithdrawAmount('');
                    loadBalances();
                    refetchOnchainBalance();
                  } else {
                    setError(result.error || 'Withdrawal failed');
                  }
                } catch (err: any) {
                  setError(err.response?.data?.error || err.message || 'Withdrawal failed');
                } finally {
                  setIsWithdrawing(false);
                }
              }}
              disabled={isProcessing || isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount || '0') <= 0 || parseFloat(withdrawAmount || '0') > poolBalance}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isWithdrawing ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Withdraw'
              )}
            </button>
          </div>

          {/* Quick amounts */}
          <div className="flex space-x-2">
            {[10, 25, 50, poolBalance].filter(amt => amt <= poolBalance).map((amt) => (
              <button
                key={amt}
                onClick={() => setWithdrawAmount(amt === poolBalance ? poolBalance.toFixed(2) : amt.toString())}
                disabled={isProcessing || isWithdrawing || poolBalance < amt}
                className="flex-1 py-1.5 text-xs bg-dark-600 hover:bg-dark-500 text-zinc-400 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {amt === poolBalance ? 'Max' : `$${amt}`}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-zinc-500 mt-3">
            Withdraw USDC from your trading pool back to your connected wallet.
          </p>
        </div>
      )}

      {/* Proxy Wallet Info */}
      {proxyWallet && (
        <div className="p-3 bg-dark-700/40 rounded-lg">
          <p className="text-[10px] text-zinc-500 mb-1">Your Polygon Trading Wallet</p>
          <div className="flex items-center justify-between">
            <code className="text-xs text-purple-300 font-mono">
              {proxyWallet.address.slice(0, 10)}...{proxyWallet.address.slice(-8)}
            </code>
            <a
              href={`https://polygonscan.com/address/${proxyWallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-purple-400 hover:text-purple-300"
            >
              View ↗
            </a>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-4 pt-3 border-t border-purple-500/10">
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          <span className="text-purple-400">💡</span>{' '}
          Deposit USDC on Polygon to your trading pool. Then allocate funds to individual bots from the bot dashboard.
        </p>
      </div>
    </div>
  );
}

export default UsdcBalancePanel;
