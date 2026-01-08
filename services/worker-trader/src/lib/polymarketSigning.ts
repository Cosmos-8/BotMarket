/**
 * Polymarket EIP-712 Order Signing Helper
 * 
 * Implements EIP-712 typed data signing for Polymarket CLOB orders.
 * This is based on Polymarket's CTF (Conditional Token Framework) Exchange contract.
 * 
 * References:
 * - Polymarket CLOB Docs: https://docs.polymarket.com/
 * - EIP-712: https://eips.ethereum.org/EIPS/eip-712
 * 
 * The signing format is the same for both Gamma (testnet) and mainnet.
 * The only difference is the chain ID used in the domain.
 */

import { ethers } from 'ethers';
import { TradingMode } from './tradingConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Side enum matching Polymarket's CLOB specification.
 * BUY = 0, SELL = 1
 */
export enum OrderSide {
  BUY = 0,
  SELL = 1,
}

/**
 * Signature type enum for Polymarket orders.
 * EOA = 0 (standard Ethereum signature)
 * POLY_PROXY = 1 (proxy/multisig)
 * POLY_GNOSIS_SAFE = 2 (Gnosis Safe)
 */
export enum SignatureType {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
}

/**
 * Input for creating a Polymarket CLOB order.
 * These fields are required to build and sign an order.
 */
export interface PolymarketOrderInput {
  /** Token ID for the outcome (YES/NO token) */
  tokenId: string;
  /** Order side: BUY (0) or SELL (1) */
  side: OrderSide;
  /** Price in cents (e.g., 50 = $0.50) - scaled 0-100 */
  price: number;
  /** Size in outcome tokens (not USD) */
  size: string;
  /** Optional fee rate in basis points (default: 0) */
  feeRateBps?: number;
  /** Optional nonce (defaults to "0") */
  nonce?: string;
  /** Optional expiration ('0' for GTC orders, timestamp string for GTD) */
  expiration?: string;
  /** Optional taker address (default: 0x0 for any taker) */
  taker?: string;
  /** Optional maker address override (default: derived from private key) */
  maker?: string;
}

/**
 * Signed order ready for submission to Polymarket CLOB.
 */
export interface SignedPolymarketOrder {
  /** The order salt (unique identifier) */
  salt: string;
  /** Maker address */
  maker: string;
  /** Signer address (usually same as maker for EOA) */
  signer: string;
  /** Taker address (0x0 for any) */
  taker: string;
  /** Token ID */
  tokenId: string;
  /** Maker amount (size * price for buys, size for sells) */
  makerAmount: string;
  /** Taker amount (size for buys, size * price for sells) */
  takerAmount: string;
  /** Order expiration timestamp */
  expiration: string;
  /** Nonce for replay protection */
  nonce: string;
  /** Fee rate in basis points */
  feeRateBps: string;
  /** Order side (0=BUY, 1=SELL) */
  side: string;
  /** Signature type (0=EOA) */
  signatureType: string;
  /** EIP-712 signature */
  signature: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Polymarket CTF Exchange contract addresses.
 * These are the same for both Gamma and mainnet as they're on Polygon.
 */
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

/**
 * Polygon chain IDs.
 * Mainnet: 137
 * Mumbai Testnet: 80001 (deprecated, Polymarket uses mainnet for Gamma)
 */
const POLYGON_CHAIN_ID = 137;

/**
 * EIP-712 Domain for Polymarket CTF Exchange.
 */
const EIP712_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: POLYGON_CHAIN_ID,
  verifyingContract: CTF_EXCHANGE_ADDRESS,
};

/**
 * EIP-712 Types for Order signing.
 */
const EIP712_ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

/**
 * Zero address for taker (allows any taker).
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a random salt for order uniqueness.
 * Must be within Number.MAX_SAFE_INTEGER to avoid precision loss when
 * converted to JSON number by Polymarket API.
 */
function generateSalt(): string {
  // Polymarket uses BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
  // We use a similar approach with crypto for better randomness
  const randomBytes = ethers.randomBytes(6); // 6 bytes = 48 bits, fits in safe integer
  const salt = ethers.toBigInt(randomBytes);
  return salt.toString();
}

/**
 * Generate a nonce for order signing.
 * Polymarket uses "0" as the default nonce for orders.
 */
function generateNonce(): string {
  return '0';
}

/**
 * Get default expiration.
 * For GTC (Good Till Cancelled) orders, expiration must be 0.
 * For GTD (Good Till Date) orders, use a future timestamp.
 */
function getDefaultExpiration(): string {
  // For GTC orders, expiration must be '0'
  return '0';
}

/**
 * Calculate maker and taker amounts for an order.
 * 
 * For BUY orders:
 * - makerAmount = USDC to pay = tokens × price (in 6-decimal USDC)
 * - takerAmount = tokens to receive (in 6-decimal format)
 * 
 * For SELL orders:
 * - makerAmount = tokens to sell (in 6-decimal format)
 * - takerAmount = USDC to receive = tokens × price (in 6-decimal USDC)
 * 
 * Price is in cents (0-100). Example: price=50 means $0.50 per token.
 * With USDC having 6 decimals:
 * - 1 USDC = 1,000,000
 * - For price=50 and size=2,000,000 (2 tokens):
 *   makerAmount = 2,000,000 × 50 / 100 = 1,000,000 (1 USDC)
 */
function calculateAmounts(
  size: string,
  price: number,
  side: OrderSide
): { makerAmount: string; takerAmount: string } {
  const sizeWei = BigInt(size);
  
  // price is in cents (0-100), divide by 100 to get decimal
  // makerAmount = size * (price / 100)
  const usdcAmount = (sizeWei * BigInt(price)) / BigInt(100);
  
  if (side === OrderSide.BUY) {
    return {
      makerAmount: usdcAmount.toString(),
      takerAmount: size,
    };
  } else {
    return {
      makerAmount: size,
      takerAmount: usdcAmount.toString(),
    };
  }
}

// ============================================================================
// Main Signing Functions
// ============================================================================

/**
 * Build an order struct from input parameters.
 * This prepares all the fields needed for EIP-712 signing.
 */
export function buildOrder(
  input: PolymarketOrderInput,
  makerAddress: string
): Omit<SignedPolymarketOrder, 'signature'> {
  const salt = generateSalt();
  const nonce = input.nonce ?? generateNonce();
  const expiration = input.expiration ?? getDefaultExpiration();
  const feeRateBps = input.feeRateBps ?? 0;
  const taker = input.taker ?? ZERO_ADDRESS;
  const maker = input.maker ?? makerAddress;
  
  const { makerAmount, takerAmount } = calculateAmounts(
    input.size,
    input.price,
    input.side
  );
  
  return {
    salt,
    maker,
    signer: makerAddress,
    taker,
    tokenId: input.tokenId,
    makerAmount,
    takerAmount,
    expiration: expiration.toString(),
    nonce: nonce.toString(),
    feeRateBps: feeRateBps.toString(),
    side: input.side.toString(),
    signatureType: SignatureType.EOA.toString(),
  };
}

/**
 * Sign a Polymarket order using EIP-712 typed data signing.
 * 
 * @param order - The order input parameters
 * @param privateKey - Polygon wallet private key (hex string, with or without 0x prefix)
 * @returns The complete signed order ready for submission
 */
export async function signPolymarketOrder(
  input: PolymarketOrderInput,
  privateKey: string
): Promise<SignedPolymarketOrder> {
  // Normalize private key (add 0x if missing)
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  // Create wallet from private key
  const wallet = new ethers.Wallet(normalizedKey);
  const makerAddress = wallet.address;
  
  // Build the order struct
  const order = buildOrder(input, makerAddress);
  
  // Prepare the typed data for signing
  const typedData = {
    salt: BigInt(order.salt),
    maker: order.maker,
    signer: order.signer,
    taker: order.taker,
    tokenId: BigInt(order.tokenId),
    makerAmount: BigInt(order.makerAmount),
    takerAmount: BigInt(order.takerAmount),
    expiration: BigInt(order.expiration),
    nonce: BigInt(order.nonce),
    feeRateBps: BigInt(order.feeRateBps),
    side: parseInt(order.side),
    signatureType: parseInt(order.signatureType),
  };
  
  // Sign using EIP-712
  const signature = await wallet.signTypedData(
    EIP712_DOMAIN,
    EIP712_ORDER_TYPES,
    typedData
  );
  
  return {
    ...order,
    signature,
  };
}

/**
 * Verify that a signed order has a valid signature.
 * Useful for debugging and testing.
 */
export function verifyOrderSignature(order: SignedPolymarketOrder): boolean {
  try {
    const typedData = {
      salt: BigInt(order.salt),
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: BigInt(order.tokenId),
      makerAmount: BigInt(order.makerAmount),
      takerAmount: BigInt(order.takerAmount),
      expiration: BigInt(order.expiration),
      nonce: BigInt(order.nonce),
      feeRateBps: BigInt(order.feeRateBps),
      side: parseInt(order.side),
      signatureType: parseInt(order.signatureType),
    };
    
    const recoveredAddress = ethers.verifyTypedData(
      EIP712_DOMAIN,
      EIP712_ORDER_TYPES,
      typedData,
      order.signature
    );
    
    return recoveredAddress.toLowerCase() === order.signer.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Get the wallet address from a private key.
 * Useful for validating configuration.
 */
export function getWalletAddress(privateKey: string): string {
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  return wallet.address;
}

