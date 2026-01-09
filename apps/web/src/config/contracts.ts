/**
 * Contract Configuration
 * 
 * Provides deployed contract addresses for the frontend.
 * 
 * After deploying contracts, update:
 * 1. NEXT_PUBLIC_BOT_REGISTRY_ADDRESS in apps/web/.env.local
 * 2. packages/contracts/deployments/polygonMainnet.json
 */

// ============================================================================
// Chain Configuration
// ============================================================================

export const POLYGON_CHAIN_ID = 137;

export const BLOCK_EXPLORER_URL = 'https://polygonscan.com';

// ============================================================================
// Contract Addresses
// ============================================================================

/**
 * BotRegistry contract address on Polygon Mainnet.
 * 
 * Set via environment variable after deployment:
 *   NEXT_PUBLIC_BOT_REGISTRY_ADDRESS=0x...
 * 
 * To deploy:
 *   1. cd packages/contracts
 *   2. export PRIVATE_KEY=0x...
 *   3. forge script script/DeployBotRegistry.s.sol --rpc-url https://polygon-rpc.com --broadcast --verify
 *   4. Copy the deployed address to .env.local
 */
export const BOT_REGISTRY_ADDRESS: `0x${string}` | null = 
  (process.env.NEXT_PUBLIC_BOT_REGISTRY_ADDRESS as `0x${string}`) || null;

/**
 * USDC Token on Polygon Mainnet.
 * 
 * Using USDC.e (bridged USDC) which is the most common USDC on Polygon.
 * Native USDC: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 * USDC.e (bridged): 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
 * 
 * Override via NEXT_PUBLIC_USDC_ADDRESS if needed.
 */
export const USDC_ADDRESS: `0x${string}` = 
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) || 
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (bridged)

/**
 * USDC Token Configuration
 */
export const USDC_TOKEN = {
  address: USDC_ADDRESS,
  chainId: POLYGON_CHAIN_ID,
  decimals: 6,
  symbol: 'USDC',
  name: 'USD Coin',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get PolygonScan URL for a contract address.
 */
export function getContractUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}

/**
 * Get PolygonScan URL for a transaction hash.
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
// Contract ABIs
// ============================================================================

export const BOT_REGISTRY_ABI = [
  // Write functions
  {
    name: 'createBot',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'metadataURI', type: 'string' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'visibility', type: 'string' },
      { name: 'feeBps', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'forkBot',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentBotId', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
      { name: 'configHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  // Read functions
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
  // Events
  {
    name: 'BotCreated',
    type: 'event',
    inputs: [
      { name: 'botId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
      { name: 'configHash', type: 'bytes32', indexed: false },
      { name: 'visibility', type: 'string', indexed: false },
      { name: 'feeBps', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BotForked',
    type: 'event',
    inputs: [
      { name: 'newBotId', type: 'uint256', indexed: true },
      { name: 'parentBotId', type: 'uint256', indexed: true },
      { name: 'forker', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
      { name: 'configHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;

/**
 * Minimal ERC20 ABI for USDC operations.
 */
export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
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
