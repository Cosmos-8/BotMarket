'use client';

/**
 * On-Chain USDC Balance Hook
 * 
 * Reads the user's real USDC balance from Polygon.
 * This is a read-only hook that never throws in the UI.
 */

import { useAccount, useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { polygon } from 'wagmi/chains';
import {
  USDC_TOKEN,
  ERC20_ABI,
} from '@/config/contracts';

// ============================================================================
// Types
// ============================================================================

export interface OnchainUsdcBalanceState {
  /** Raw balance in smallest units (bigint) */
  onchainBalanceRaw: bigint | null;
  /** Formatted balance as human-readable string (e.g., "12.34") */
  onchainBalance: string;
  /** Token symbol (default "USDC") */
  symbol: string;
  /** Whether the balance is loading */
  isLoading: boolean;
  /** Whether there was an error fetching */
  isError: boolean;
  /** Error message if any */
  errorMessage: string | null;
  /** Whether wallet is ready (connected + correct chain) */
  isWalletReady: boolean;
  /** The connected address */
  address: `0x${string}` | undefined;
  /** Refetch the balance */
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to read the user's on-chain USDC balance from Polygon.
 * 
 * Usage:
 * ```tsx
 * const { onchainBalance, isLoading, isWalletReady } = useOnchainUsdcBalance();
 * 
 * if (!isWalletReady) {
 *   return <p>Connect wallet to view balance</p>;
 * }
 * 
 * return <p>Balance: {onchainBalance} USDC</p>;
 * ```
 */
export function useOnchainUsdcBalance(): OnchainUsdcBalanceState {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // Check if wallet is ready (connected + correct chain - Polygon)
  const isCorrectChain = chainId === polygon.id;
  const isWalletReady = isConnected && isCorrectChain && !!address;

  // Read balance from USDC contract
  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
    error: balanceError,
    refetch,
  } = useReadContract({
    address: USDC_TOKEN.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: polygon.id,
    query: {
      enabled: isWalletReady,
      staleTime: 30_000, // Cache for 30 seconds
      retry: 1,
    },
  });

  // Format the balance
  let onchainBalanceRaw: bigint | null = null;
  let onchainBalance = '0.00';
  let errorMessage: string | null = null;

  if (balanceData !== undefined && balanceData !== null) {
    try {
      onchainBalanceRaw = balanceData as bigint;
      const formatted = formatUnits(onchainBalanceRaw, USDC_TOKEN.decimals);
      // Format to 2 decimal places
      onchainBalance = parseFloat(formatted).toFixed(2);
    } catch (err) {
      console.error('[useOnchainUsdcBalance] Error formatting balance:', err);
      errorMessage = 'Failed to format balance';
    }
  }

  // Handle errors gracefully
  if (isBalanceError && balanceError) {
    console.error('[useOnchainUsdcBalance] RPC error:', balanceError);
    errorMessage = 'RPC error fetching balance';
  }

  // If wallet not ready, return zero balance without error
  if (!isWalletReady) {
    return {
      onchainBalanceRaw: null,
      onchainBalance: '0.00',
      symbol: USDC_TOKEN.symbol,
      isLoading: false,
      isError: false,
      errorMessage: null,
      isWalletReady: false,
      address,
      refetch: () => {},
    };
  }

  return {
    onchainBalanceRaw,
    onchainBalance,
    symbol: USDC_TOKEN.symbol,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
    errorMessage,
    isWalletReady,
    address,
    refetch,
  };
}

export default useOnchainUsdcBalance;
