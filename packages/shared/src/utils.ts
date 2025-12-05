import crypto from 'crypto';
import { WebhookPayload, ParsedSignal } from './schemas';
import { SIGNAL_TYPES } from './constants';

// ============================================================================
// Proxy Wallet Generation
// ============================================================================

export interface GeneratedWallet {
  address: string;
  privateKey: string;
}

/**
 * Generate a new Polygon-compatible wallet for a bot.
 * This creates a dedicated "proxy wallet" that the bot uses for trading.
 * 
 * @returns Object containing the wallet address and private key
 */
export function generateProxyWallet(): GeneratedWallet {
  // Generate 32 random bytes for the private key
  const privateKeyBytes = crypto.randomBytes(32);
  const privateKey = '0x' + privateKeyBytes.toString('hex');
  
  // Derive address from private key using keccak256
  // For a proper implementation, we'd use ethers.js, but for MVP we'll 
  // return the private key and let the caller derive the address
  // The address will be derived when we use the key with ethers
  
  return {
    address: '', // Will be derived by ethers when used
    privateKey,
  };
}

/**
 * Derive wallet address from private key using ethers-compatible approach.
 * Note: This is a placeholder - actual derivation happens in the API with ethers.
 */
export function deriveAddressFromKey(privateKey: string): string {
  // This will be implemented in the API where ethers is available
  // For now, return empty - the API will derive it
  return '';
}

/**
 * Parse webhook payload into standardized signal format
 * Supports multiple formats like the existing Python bot
 */
export function parseWebhookSignal(payload: WebhookPayload): ParsedSignal | null {
  // Format 1: Direct signal
  if ('signal' in payload) {
    const signal = String(payload.signal).toUpperCase().trim();
    if (signal === SIGNAL_TYPES.LONG || signal === SIGNAL_TYPES.SHORT || signal === SIGNAL_TYPES.CLOSE) {
      return {
        signalType: signal as typeof SIGNAL_TYPES.LONG | typeof SIGNAL_TYPES.SHORT | typeof SIGNAL_TYPES.CLOSE,
        rawPayload: payload,
      };
    }
  }

  // Format 2: Text field
  if ('text' in payload) {
    const text = String(payload.text).toUpperCase().trim();
    if (text.includes('LONG') || text.includes('YES')) {
      return {
        signalType: SIGNAL_TYPES.LONG,
        rawPayload: payload,
      };
    } else if (text.includes('SHORT') || text.includes('NO')) {
      return {
        signalType: SIGNAL_TYPES.SHORT,
        rawPayload: payload,
      };
    }
  }

  // Format 3: Message field
  if ('message' in payload) {
    const message = String(payload.message).toLowerCase();
    if (message.includes('green') || message.includes('up') || message.includes('yes') || message.includes('buy long')) {
      return {
        signalType: SIGNAL_TYPES.LONG,
        rawPayload: payload,
      };
    } else if (message.includes('red') || message.includes('down') || message.includes('no') || message.includes('buy short')) {
      return {
        signalType: SIGNAL_TYPES.SHORT,
        rawPayload: payload,
      };
    }
  }

  // Format 4: Direction field
  if ('direction' in payload) {
    const direction = String(payload.direction).toUpperCase().trim();
    if (direction === SIGNAL_TYPES.LONG || direction === 'YES') {
      return {
        signalType: SIGNAL_TYPES.LONG,
        rawPayload: payload,
      };
    } else if (direction === SIGNAL_TYPES.SHORT || direction === 'NO') {
      return {
        signalType: SIGNAL_TYPES.SHORT,
        rawPayload: payload,
      };
    }
  }

  // Format 5: Explicit [BUY]/[SELL]/[CLOSE] format (recommended)
  const messageStr = JSON.stringify(payload).toUpperCase();
  if (messageStr.includes('[BUY]') || messageStr.includes('BUY SIGNAL')) {
    return {
      signalType: SIGNAL_TYPES.LONG,
      rawPayload: payload,
    };
  } else if (messageStr.includes('[SELL]') || messageStr.includes('SELL SIGNAL')) {
    return {
      signalType: SIGNAL_TYPES.SHORT,
      rawPayload: payload,
    };
  } else if (messageStr.includes('[CLOSE]') || messageStr.includes('CLOSE SIGNAL')) {
    return {
      signalType: SIGNAL_TYPES.CLOSE,
      rawPayload: payload,
    };
  }

  return null;
}

/**
 * Hash payload for deduplication
 */
export function hashPayload(payload: unknown): string {
  const str = JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Encrypt private key (simple encryption for MVP)
 * TODO: Replace with proper KMS in production
 */
export function encryptPrivateKey(privateKey: string, secret: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secret, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt private key
 */
export function decryptPrivateKey(encrypted: string, secret: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(secret, 'salt', 32);
  const [ivHex, encryptedHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify webhook secret
 */
export function verifyWebhookSecret(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(expected)
  );
}

/**
 * Calculate config hash for on-chain storage
 */
export function calculateConfigHash(config: unknown): string {
  const str = JSON.stringify(config);
  return crypto.createHash('sha256').update(str).digest('hex');
}

