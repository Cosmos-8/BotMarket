'use client';

/**
 * On-Chain Bot Creation Hook
 * 
 * Handles registering bots on-chain via BotRegistry contract on Polygon.
 * Uses wagmi v2 hooks for contract interaction.
 */

import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { polygon } from 'wagmi/chains';
import {
  BOT_REGISTRY_ADDRESS,
  BOT_REGISTRY_ABI,
  getTransactionUrl,
  isContractsConfigured,
} from '@/config/contracts';
import { useWallet } from './useWallet';

// ============================================================================
// Types
// ============================================================================

export interface CreateBotOnChainParams {
  /** Bot ID from the API (used in metadata URI) */
  botId: string;
  /** Bot configuration object (will be hashed) */
  config: Record<string, any>;
  /** Visibility: "PUBLIC" or "PRIVATE" */
  visibility: string;
  /** Fee in basis points (0-10000), defaults to 0 */
  feeBps?: number;
}

export interface CreateBotOnChainResult {
  /** Whether the on-chain registration is in progress */
  isRegistering: boolean;
  /** Whether the transaction is being confirmed */
  isConfirming: boolean;
  /** Transaction hash if submitted */
  txHash: `0x${string}` | undefined;
  /** Error message if failed */
  error: string | null;
  /** Whether the transaction was confirmed */
  isConfirmed: boolean;
  /** PolygonScan URL for the transaction */
  txUrl: string | null;
  /** On-chain bot ID from the event (if we could parse it) */
  onChainBotId: bigint | null;
}

export interface UseCreateBotOnChainReturn extends CreateBotOnChainResult {
  /** Register the bot on-chain */
  registerOnChain: (params: CreateBotOnChainParams) => Promise<void>;
  /** Reset the state for a new registration */
  reset: () => void;
  /** Whether on-chain registration is available (wallet connected, correct chain, contract configured) */
  canRegister: boolean;
  /** Reason why registration is not available */
  unavailableReason: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a config hash from the bot configuration.
 * Uses keccak256 of the JSON-stringified config.
 */
function generateConfigHash(config: Record<string, any>): `0x${string}` {
  const configString = JSON.stringify(config, Object.keys(config).sort());
  return keccak256(toBytes(configString));
}

/**
 * Generate metadata URI for the bot.
 * Points to the API endpoint for fetching bot data.
 */
function generateMetadataURI(botId: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${apiUrl}/bots/${botId}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useCreateBotOnChain(): UseCreateBotOnChainReturn {
  const { address, isConnected, isCorrectChain } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [onChainBotId, setOnChainBotId] = useState<bigint | null>(null);

  // wagmi write contract hook
  const {
    writeContract,
    data: txHash,
    isPending: isRegistering,
    reset: resetWrite,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if registration is available
  const contractsConfigured = isContractsConfigured();
  const canRegister = isConnected && isCorrectChain && contractsConfigured;

  let unavailableReason: string | null = null;
  if (!isConnected) {
    unavailableReason = 'Wallet not connected';
  } else if (!isCorrectChain) {
    unavailableReason = 'Please switch to Polygon';
  } else if (!contractsConfigured) {
    unavailableReason = 'BotRegistry contract not configured';
  }

  // Generate transaction URL
  const txUrl = txHash ? getTransactionUrl(txHash) : null;

  // Register bot on-chain
  const registerOnChain = useCallback(async (params: CreateBotOnChainParams) => {
    setError(null);
    setOnChainBotId(null);

    if (!canRegister) {
      setError(unavailableReason || 'Cannot register on-chain');
      return;
    }

    if (!BOT_REGISTRY_ADDRESS) {
      setError('BotRegistry contract address not configured');
      return;
    }

    try {
      const configHash = generateConfigHash(params.config);
      const metadataURI = generateMetadataURI(params.botId);
      const feeBps = BigInt(params.feeBps ?? 0);

      console.log('[OnChain] Registering bot on Polygon:', {
        metadataURI,
        configHash,
        visibility: params.visibility,
        feeBps: feeBps.toString(),
      });

      writeContract({
        address: BOT_REGISTRY_ADDRESS,
        abi: BOT_REGISTRY_ABI,
        functionName: 'createBot',
        args: [metadataURI, configHash, params.visibility, feeBps],
        chainId: polygon.id,
      });
    } catch (err: any) {
      console.error('[OnChain] Error preparing transaction:', err);
      setError(err.message || 'Failed to prepare transaction');
    }
  }, [canRegister, unavailableReason, writeContract]);

  // Reset state
  const reset = useCallback(() => {
    resetWrite();
    setError(null);
    setOnChainBotId(null);
  }, [resetWrite]);

  // Handle write errors
  const finalError = error || (writeError ? (writeError as any).shortMessage || writeError.message : null);

  return {
    isRegistering,
    isConfirming,
    txHash,
    error: finalError,
    isConfirmed,
    txUrl,
    onChainBotId,
    registerOnChain,
    reset,
    canRegister,
    unavailableReason,
  };
}

export default useCreateBotOnChain;
