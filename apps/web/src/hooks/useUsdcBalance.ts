'use client';

/**
 * USDC Balance Hook
 * 
 * Manages the user's USDC trading balance for bot operations.
 * This is a mock/offchain balance for the hackathon demo.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UsdcBalanceState {
  /** Current USDC balance */
  balance: number;
  /** Whether balance is loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Refetch the balance */
  refetch: () => Promise<void>;
  /** Fund the balance with an amount */
  fund: (amount: number) => Promise<boolean>;
  /** Whether a fund operation is in progress */
  isFunding: boolean;
}

/**
 * Hook to manage USDC trading balance.
 * 
 * Usage:
 * ```tsx
 * const { balance, isLoading, fund, isFunding } = useUsdcBalance();
 * 
 * // Fund 25 USDC
 * await fund(25);
 * ```
 */
export function useUsdcBalance(): UsdcBalanceState {
  const { address, isConnected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address) {
      setBalance(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/balance/${address}`);
      const data = await response.json();

      if (data.success) {
        setBalance(data.data.usdcBalance);
      } else {
        setError(data.error || 'Failed to fetch balance');
      }
    } catch (err: any) {
      console.error('Error fetching balance:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  // Fund balance
  const fund = useCallback(async (amount: number): Promise<boolean> => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return false;
    }

    if (amount <= 0) {
      setError('Amount must be positive');
      return false;
    }

    setIsFunding(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/balance/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, amount }),
      });

      const data = await response.json();

      if (data.success) {
        setBalance(data.data.usdcBalance);
        return true;
      } else {
        setError(data.error || 'Failed to fund balance');
        return false;
      }
    } catch (err: any) {
      console.error('Error funding balance:', err);
      setError('Failed to connect to server');
      return false;
    } finally {
      setIsFunding(false);
    }
  }, [address, isConnected]);

  // Fetch balance when address changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
    fund,
    isFunding,
  };
}

export default useUsdcBalance;

