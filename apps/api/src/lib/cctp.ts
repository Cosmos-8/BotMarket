/**
 * Circle CCTP (Cross-Chain Transfer Protocol) Integration
 * 
 * Handles native USDC bridging between Base and Polygon.
 * 
 * Flow:
 * 1. Burn USDC on source chain (Base)
 * 2. Get attestation from Circle
 * 3. Mint USDC on destination chain (Polygon)
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';

// ============================================================================
// CCTP Contract Addresses (Mainnet)
// ============================================================================

export const CCTP_CONFIG = {
  base: {
    chainId: 8453,
    domain: 6, // CCTP domain ID for Base
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
    messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  polygon: {
    chainId: 137,
    domain: 7, // CCTP domain ID for Polygon
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
    messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  attestationApi: 'https://iris-api.circle.com/attestations',
} as const;

// ============================================================================
// ABIs (Minimal)
// ============================================================================

const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 nonce)',
  'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)',
];

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
  'function usedNonces(bytes32) view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

// ============================================================================
// Types
// ============================================================================

export interface BridgeRequest {
  id: string;
  userAddress: string;
  amount: number; // in USDC (6 decimals)
  direction: 'base_to_polygon' | 'polygon_to_base';
  status: 'pending' | 'burning' | 'attesting' | 'minting' | 'completed' | 'failed';
  sourceTxHash?: string;
  destinationTxHash?: string;
  messageBytes?: string;
  messageHash?: string;
  attestation?: string;
  nonce?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface AttestationResponse {
  status: 'pending' | 'complete';
  attestation?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert address to bytes32 format for CCTP
 */
export function addressToBytes32(address: string): string {
  return ethers.zeroPadValue(address, 32);
}

/**
 * Get provider for a chain
 */
export function getProvider(chain: 'base' | 'polygon'): JsonRpcProvider {
  const config = CCTP_CONFIG[chain];
  return new JsonRpcProvider(config.rpcUrl);
}

/**
 * Get wallet for signing transactions
 */
export function getWallet(privateKey: string, chain: 'base' | 'polygon'): Wallet {
  const provider = getProvider(chain);
  return new Wallet(privateKey, provider);
}

// ============================================================================
// CCTP Bridge Functions
// ============================================================================

/**
 * Step 1: Burn USDC on source chain
 * 
 * This initiates the cross-chain transfer by burning USDC on the source chain.
 * The user must have already approved the TokenMessenger to spend their USDC.
 */
export async function burnUsdcForBridge(
  wallet: Wallet,
  amount: bigint, // in wei (6 decimals for USDC)
  destinationAddress: string,
  sourceChain: 'base' | 'polygon' = 'base'
): Promise<{ txHash: string; nonce: string; messageBytes: string; messageHash: string }> {
  const sourceConfig = CCTP_CONFIG[sourceChain];
  const destChain = sourceChain === 'base' ? 'polygon' : 'base';
  const destConfig = CCTP_CONFIG[destChain];

  // Get contracts
  const tokenMessenger = new Contract(sourceConfig.tokenMessenger, TOKEN_MESSENGER_ABI, wallet);
  const usdc = new Contract(sourceConfig.usdc, ERC20_ABI, wallet);

  // Check and approve USDC if needed
  const allowance = await usdc.allowance(wallet.address, sourceConfig.tokenMessenger);
  if (allowance < amount) {
    console.log(`[CCTP] Approving USDC spend...`);
    const approveTx = await usdc.approve(sourceConfig.tokenMessenger, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`[CCTP] Approval confirmed: ${approveTx.hash}`);
  }

  // Convert destination address to bytes32
  const mintRecipient = addressToBytes32(destinationAddress);

  // Call depositForBurn
  console.log(`[CCTP] Initiating burn of ${ethers.formatUnits(amount, 6)} USDC...`);
  const tx = await tokenMessenger.depositForBurn(
    amount,
    destConfig.domain,
    mintRecipient,
    sourceConfig.usdc
  );

  const receipt = await tx.wait();
  console.log(`[CCTP] Burn transaction confirmed: ${receipt.hash}`);

  // Extract nonce and message from logs
  const depositEvent = receipt.logs.find((log: any) => {
    try {
      const parsed = tokenMessenger.interface.parseLog(log);
      return parsed?.name === 'DepositForBurn';
    } catch {
      return false;
    }
  });

  if (!depositEvent) {
    throw new Error('DepositForBurn event not found in transaction');
  }

  // Get the message bytes from MessageSent event (from MessageTransmitter)
  // The message hash is keccak256 of the message bytes
  const messageSentTopic = ethers.id('MessageSent(bytes)');
  const messageLog = receipt.logs.find((log: any) => log.topics[0] === messageSentTopic);
  
  let messageBytes = '';
  let messageHash = '';
  
  if (messageLog) {
    // Decode the message bytes from the log data
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const decoded = abiCoder.decode(['bytes'], messageLog.data);
    messageBytes = decoded[0];
    messageHash = ethers.keccak256(messageBytes);
  }

  const parsed = tokenMessenger.interface.parseLog(depositEvent);
  const nonce = parsed?.args?.nonce?.toString() || '0';

  return {
    txHash: receipt.hash,
    nonce,
    messageBytes,
    messageHash,
  };
}

/**
 * Step 2: Get attestation from Circle
 * 
 * Circle signs the message after confirming the burn on the source chain.
 * This typically takes 10-15 minutes.
 */
export async function getAttestation(messageHash: string): Promise<AttestationResponse> {
  const url = `${CCTP_CONFIG.attestationApi}/${messageHash}`;
  
  try {
    const response = await fetch(url);
    
    if (response.status === 404) {
      return { status: 'pending' };
    }
    
    if (!response.ok) {
      throw new Error(`Attestation API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'complete' && data.attestation) {
      return {
        status: 'complete',
        attestation: data.attestation,
      };
    }
    
    return { status: 'pending' };
  } catch (error) {
    console.error('[CCTP] Error fetching attestation:', error);
    return { status: 'pending' };
  }
}

/**
 * Step 3: Mint USDC on destination chain
 * 
 * Uses the attestation to mint USDC on the destination chain.
 */
export async function mintUsdc(
  wallet: Wallet,
  messageBytes: string,
  attestation: string,
  destChain: 'base' | 'polygon' = 'polygon'
): Promise<string> {
  const destConfig = CCTP_CONFIG[destChain];
  
  const messageTransmitter = new Contract(
    destConfig.messageTransmitter,
    MESSAGE_TRANSMITTER_ABI,
    wallet
  );

  console.log(`[CCTP] Minting USDC on ${destChain}...`);
  const tx = await messageTransmitter.receiveMessage(messageBytes, attestation);
  const receipt = await tx.wait();
  
  console.log(`[CCTP] Mint confirmed: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Check USDC balance on a chain
 */
export async function getUsdcBalance(address: string, chain: 'base' | 'polygon'): Promise<bigint> {
  const config = CCTP_CONFIG[chain];
  const provider = getProvider(chain);
  const usdc = new Contract(config.usdc, ERC20_ABI, provider);
  return await usdc.balanceOf(address);
}

/**
 * Transfer USDC on a chain (for internal transfers)
 */
export async function transferUsdc(
  wallet: Wallet,
  to: string,
  amount: bigint,
  chain: 'base' | 'polygon'
): Promise<string> {
  const config = CCTP_CONFIG[chain];
  const usdc = new Contract(config.usdc, ERC20_ABI, wallet);
  
  const tx = await usdc.transfer(to, amount);
  const receipt = await tx.wait();
  
  return receipt.hash;
}

// ============================================================================
// High-Level Bridge Functions
// ============================================================================

/**
 * Initiate a bridge from Base to Polygon
 * 
 * This is called after user deposits USDC to our platform wallet on Base.
 */
export async function initiateBridgeToPolygon(
  platformWallet: Wallet, // Platform wallet on Base holding user's deposit
  destinationAddress: string, // User's Polygon proxy wallet
  amount: bigint
): Promise<{ txHash: string; messageHash: string; messageBytes: string }> {
  console.log(`[CCTP] Bridging ${ethers.formatUnits(amount, 6)} USDC to Polygon`);
  console.log(`[CCTP] Destination: ${destinationAddress}`);
  
  const result = await burnUsdcForBridge(
    platformWallet,
    amount,
    destinationAddress,
    'base'
  );
  
  return {
    txHash: result.txHash,
    messageHash: result.messageHash,
    messageBytes: result.messageBytes,
  };
}

/**
 * Complete a bridge by minting on destination
 */
export async function completeBridge(
  platformWallet: Wallet, // Platform wallet on Polygon
  messageBytes: string,
  attestation: string
): Promise<string> {
  return await mintUsdc(platformWallet, messageBytes, attestation, 'polygon');
}

export default {
  CCTP_CONFIG,
  burnUsdcForBridge,
  getAttestation,
  mintUsdc,
  getUsdcBalance,
  transferUsdc,
  initiateBridgeToPolygon,
  completeBridge,
  addressToBytes32,
  getProvider,
  getWallet,
};

