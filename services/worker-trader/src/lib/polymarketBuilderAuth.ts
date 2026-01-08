/**
 * Polymarket Builder Program Authentication
 * 
 * Implements authentication headers for Polymarket Builder Program API access.
 * This allows orders to be attributed to your builder account and bypasses
 * wallet authorization restrictions.
 * 
 * References:
 * - Polymarket Builder Docs: https://docs.polymarket.com/developers/builders/
 */

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Builder authentication credentials.
 */
export interface BuilderCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Request information for signing.
 */
export interface SigningRequest {
  method: string;
  path: string;
  body?: string;
  timestamp?: number;
  /** Wallet address making the request (required for L2 auth) */
  address?: string;
}

/**
 * Builder authentication headers (Level 2).
 * Polymarket requires POLY_ADDRESS for authenticated requests.
 */
export interface BuilderAuthHeaders {
  'POLY_ADDRESS': string;
  'POLY_API_KEY': string;
  'POLY_SIGNATURE': string;
  'POLY_TIMESTAMP': string;
  'POLY_PASSPHRASE': string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert URL-safe base64 to standard base64.
 * Polymarket uses URL-safe base64 (- and _ instead of + and /).
 */
function urlSafeBase64ToStandard(urlSafe: string): string {
  return urlSafe.replace(/-/g, '+').replace(/_/g, '/');
}

/**
 * Convert standard base64 to URL-safe base64.
 */
function standardBase64ToUrlSafe(standard: string): string {
  return standard.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Generate HMAC-SHA256 signature using URL-safe base64.
 * 
 * Polymarket uses URL-safe base64 for both the secret and the output signature.
 * This matches their Python client implementation in py-clob-client.
 */
function createSignature(secret: string, message: string): string {
  // Decode URL-safe base64 secret to get raw bytes for HMAC
  const standardSecret = urlSafeBase64ToStandard(secret);
  const secretBytes = Buffer.from(standardSecret, 'base64');
  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(message);
  
  // Encode result as URL-safe base64
  const standardB64 = hmac.digest('base64');
  return standardBase64ToUrlSafe(standardB64);
}

/**
 * Create the message to sign for Polymarket builder authentication.
 * Format: timestamp + method + path + body
 */
function createSigningMessage(request: SigningRequest): string {
  const timestamp = request.timestamp || Math.floor(Date.now() / 1000);
  const method = request.method.toUpperCase();
  const path = request.path;
  const body = request.body || '';
  
  return `${timestamp}${method}${path}${body}`;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate builder authentication headers for a Polymarket API request.
 * 
 * These are Level 2 (L2) headers that include:
 * - POLY_ADDRESS: The wallet address making the request
 * - POLY_API_KEY: Your builder API key
 * - POLY_SIGNATURE: HMAC signature of the request
 * - POLY_TIMESTAMP: Unix timestamp
 * - POLY_PASSPHRASE: Your API passphrase
 * 
 * @param credentials - Builder API credentials (key, secret, passphrase)
 * @param request - Request details (method, path, body, address)
 * @returns Authentication headers to include in the request
 */
export function generateBuilderAuthHeaders(
  credentials: BuilderCredentials,
  request: SigningRequest
): BuilderAuthHeaders {
  if (!request.address) {
    throw new Error('Wallet address is required for builder authentication');
  }
  
  const timestamp = request.timestamp || Math.floor(Date.now() / 1000);
  const message = createSigningMessage({ ...request, timestamp });
  const signature = createSignature(credentials.secret, message);
  
  return {
    'POLY_ADDRESS': request.address,
    'POLY_API_KEY': credentials.apiKey,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp.toString(),
    'POLY_PASSPHRASE': credentials.passphrase,
  };
}

/**
 * Check if builder credentials are valid (all required fields present).
 */
export function hasBuilderCredentials(credentials: BuilderCredentials | null | undefined): boolean {
  if (!credentials) return false;
  return !!(
    credentials.apiKey &&
    credentials.secret &&
    credentials.passphrase
  );
}

/**
 * Create builder credentials from environment variables.
 * Returns null if credentials are not fully configured.
 */
export function getBuilderCredentialsFromEnv(): BuilderCredentials | null {
  const apiKey = process.env.POLYMARKET_BUILDER_API_KEY;
  const secret = process.env.POLYMARKET_BUILDER_SECRET;
  const passphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE;
  
  if (!apiKey || !secret || !passphrase) {
    return null;
  }
  
  return {
    apiKey,
    secret,
    passphrase,
  };
}

