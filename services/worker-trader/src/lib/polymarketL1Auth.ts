/**
 * Polymarket Level 1 (L1) Authentication
 * 
 * L1 auth is used to create/derive API credentials for a wallet.
 * It requires signing an EIP-712 "ClobAuth" message to prove wallet ownership.
 * 
 * Once L1 auth is used to create API credentials, those credentials
 * are used for L2 auth on all subsequent trading requests.
 */

import { ethers } from 'ethers';
import axios from 'axios';

// ============================================================================
// Constants
// ============================================================================

const CLOB_DOMAIN_NAME = 'ClobAuthDomain';
const CLOB_VERSION = '1';
const MSG_TO_SIGN = 'This message attests that I control the given wallet';

// Polygon mainnet chain ID
const POLYGON_CHAIN_ID = 137;

// EIP-712 domain for ClobAuth
const CLOB_AUTH_DOMAIN = {
  name: CLOB_DOMAIN_NAME,
  version: CLOB_VERSION,
  chainId: POLYGON_CHAIN_ID,
};

// EIP-712 types for ClobAuth
const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
};

// ============================================================================
// Types
// ============================================================================

export interface L1AuthHeaders {
  'POLY_ADDRESS': string;
  'POLY_SIGNATURE': string;
  'POLY_TIMESTAMP': string;
  'POLY_NONCE': string;
}

export interface ApiCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

// ============================================================================
// L1 Auth Functions
// ============================================================================

/**
 * Generate L1 authentication headers by signing a ClobAuth message.
 * These headers are used to create or derive API credentials.
 */
export async function generateL1AuthHeaders(
  privateKey: string,
  nonce: number = 0
): Promise<L1AuthHeaders> {
  // Normalize private key
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  const address = wallet.address;
  const timestamp = Math.floor(Date.now() / 1000);

  // Create the ClobAuth message
  const clobAuthMessage = {
    address: address,
    timestamp: timestamp.toString(),
    nonce: nonce,
    message: MSG_TO_SIGN,
  };

  // Sign using EIP-712
  const signature = await wallet.signTypedData(
    CLOB_AUTH_DOMAIN,
    CLOB_AUTH_TYPES,
    clobAuthMessage
  );

  return {
    'POLY_ADDRESS': address,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp.toString(),
    'POLY_NONCE': nonce.toString(),
  };
}

// ============================================================================
// API Credential Functions
// ============================================================================

const CLOB_API_BASE = 'https://clob.polymarket.com';

/**
 * Create new API credentials for a wallet.
 * This should be called once per wallet to generate credentials.
 * 
 * WARNING: Credentials cannot be recovered after creation!
 * Store them securely.
 */
export async function createApiCredentials(
  privateKey: string,
  nonce: number = 0
): Promise<ApiCredentials> {
  const headers = await generateL1AuthHeaders(privateKey, nonce);
  
  try {
    const response = await axios.post(
      `${CLOB_API_BASE}/auth/api-key`,
      {},
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (response.data && response.data.apiKey) {
      return {
        apiKey: response.data.apiKey,
        secret: response.data.secret,
        passphrase: response.data.passphrase,
      };
    }

    throw new Error('Invalid response from Polymarket API');
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const errorMsg = error.response.data?.error || error.response.data?.message || 'Unknown error';
      throw new Error(`Failed to create API credentials: ${errorMsg}`);
    }
    throw error;
  }
}

/**
 * Derive existing API credentials for a wallet.
 * Use this if credentials were already created for a wallet/nonce combination.
 */
export async function deriveApiCredentials(
  privateKey: string,
  nonce: number = 0
): Promise<ApiCredentials> {
  const headers = await generateL1AuthHeaders(privateKey, nonce);
  
  try {
    const response = await axios.get(
      `${CLOB_API_BASE}/auth/derive-api-key`,
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (response.data && response.data.apiKey) {
      return {
        apiKey: response.data.apiKey,
        secret: response.data.secret,
        passphrase: response.data.passphrase,
      };
    }

    throw new Error('Invalid response from Polymarket API');
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const errorMsg = error.response.data?.error || error.response.data?.message || 'Unknown error';
      throw new Error(`Failed to derive API credentials: ${errorMsg}`);
    }
    throw error;
  }
}

/**
 * Create or derive API credentials for a wallet.
 * Tries to create first, falls back to derive if already exists.
 */
export async function createOrDeriveApiCredentials(
  privateKey: string,
  nonce: number = 0
): Promise<ApiCredentials> {
  try {
    return await createApiCredentials(privateKey, nonce);
  } catch (createError: any) {
    // If creation fails (maybe credentials already exist), try to derive
    console.log('Create failed, trying to derive existing credentials...');
    try {
      return await deriveApiCredentials(privateKey, nonce);
    } catch (deriveError: any) {
      // Both failed - throw the original create error
      throw createError;
    }
  }
}

/**
 * Get wallet address from private key.
 */
export function getWalletAddressFromKey(privateKey: string): string {
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  return wallet.address;
}

