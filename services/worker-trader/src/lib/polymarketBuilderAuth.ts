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
}

/**
 * Builder authentication headers.
 */
export interface BuilderAuthHeaders {
  'POLY_API_KEY': string;
  'POLY_SIGNATURE': string;
  'POLY_TIMESTAMP': string;
  'POLY_PASSPHRASE': string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate HMAC-SHA256 signature.
 * 
 * Note: The secret is expected to be base64-encoded as provided by Polymarket.
 * If authentication fails, the secret format may need adjustment.
 */
function createSignature(secret: string, message: string): string {
  // Decode base64 secret to get raw bytes for HMAC
  const secretBytes = Buffer.from(secret, 'base64');
  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(message);
  return hmac.digest('base64');
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
 * @param credentials - Builder API credentials (key, secret, passphrase)
 * @param request - Request details (method, path, body)
 * @returns Authentication headers to include in the request
 */
export function generateBuilderAuthHeaders(
  credentials: BuilderCredentials,
  request: SigningRequest
): BuilderAuthHeaders {
  const timestamp = request.timestamp || Math.floor(Date.now() / 1000);
  const message = createSigningMessage({ ...request, timestamp });
  const signature = createSignature(credentials.secret, message);
  
  return {
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

