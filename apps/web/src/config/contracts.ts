/**
 * Contract Configuration
 * 
 * Provides deployed contract addresses for the frontend.
 * 
 * After deploying contracts, update:
 * 1. NEXT_PUBLIC_BOT_REGISTRY_ADDRESS in apps/web/.env.local
 * 2. packages/contracts/deployments/baseSepolia.json
 */

// ============================================================================
// Chain Configuration
// ============================================================================

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BLOCK_EXPLORER_URL = 'https://sepolia.basescan.org';

// ============================================================================
// Contract Addresses
// ============================================================================

/**
 * BotRegistry contract address on Base Sepolia.
 * 
 * Set via environment variable after deployment:
 *   NEXT_PUBLIC_BOT_REGISTRY_ADDRESS=0x...
 * 
 * To deploy:
 *   1. cd packages/contracts
 *   2. export PRIVATE_KEY=0x...
 *   3. pnpm deploy:base-sepolia
 *   4. Copy the deployed address to .env.local
 */
export const BOT_REGISTRY_ADDRESS: `0x${string}` | null = 
  (process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS as `0x${string}`) || null;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get BaseScan URL for a contract address.
 */
export function getContractUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}

/**
 * Get BaseScan URL for a transaction hash.
 */
export function getTransactionUrl(txHash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Check if contracts are configured.
 */
export function isContractsConfigured(): boolean {
  return BOT_REGISTRY_ADDRESS !== null && BOT_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

/**
 * Format address for display (shortened).
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Contract ABIs (minimal for read operations)
// ============================================================================

export const BOT_REGISTRY_ABI = [
  {
    name: 'nextBotId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getBot',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'botId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'botId', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'parentBotId', type: 'uint256' },
          { name: 'metadataURI', type: 'string' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'visibility', type: 'string' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getUserBots',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
  },
] as const;

