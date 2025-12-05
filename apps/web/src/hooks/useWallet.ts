'use client';

/**
 * Wallet Hook
 * 
 * Provides easy access to connected wallet state across the app.
 */

import { useAccount, useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export interface WalletState {
  /** Connected wallet address (undefined if not connected) */
  address: `0x${string}` | undefined;
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Whether the wallet is currently connecting */
  isConnecting: boolean;
  /** Whether the wallet is disconnecting */
  isDisconnected: boolean;
  /** Current chain ID */
  chainId: number | undefined;
  /** Whether we're on the correct chain (Base) */
  isCorrectChain: boolean;
  /** Shortened address for display (e.g., "0x1234...abcd") */
  shortAddress: string | undefined;
}

/**
 * Hook to access wallet connection state.
 * 
 * Usage:
 * ```tsx
 * const { address, isConnected, shortAddress } = useWallet();
 * 
 * if (!isConnected) {
 *   return <p>Please connect your wallet</p>;
 * }
 * 
 * return <p>Connected as {shortAddress}</p>;
 * ```
 */
export function useWallet(): WalletState {
  const { address, isConnected, isConnecting, isDisconnected } = useAccount();
  const chainId = useChainId();

  // Format address for display
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : undefined;

  // Check if on correct chain
  const isCorrectChain = chainId === baseSepolia.id;

  return {
    address,
    isConnected,
    isConnecting,
    isDisconnected,
    chainId,
    isCorrectChain,
    shortAddress,
  };
}

export default useWallet;

