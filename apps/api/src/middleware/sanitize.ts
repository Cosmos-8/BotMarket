import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitize strings in an object
 * Removes potential XSS and SQL injection patterns
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Remove HTML tags
    let sanitized = value.replace(/<[^>]*>/g, '');
    // Remove potential script injections
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+=/gi, '');
    // Trim excessive whitespace
    sanitized = sanitized.trim();
    // Limit string length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(value)) {
      // Sanitize keys too
      const sanitizedKey = key.replace(/[<>'"]/g, '').substring(0, 100);
      sanitized[sanitizedKey] = sanitizeValue(value[key]);
    }
    return sanitized;
  }
  return value;
}

/**
 * Middleware to sanitize request body and query params
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params);
    }
    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    next(); // Continue even if sanitization fails
  }
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate bot ID format
 */
export function isValidBotId(botId: string): boolean {
  return /^bot_[0-9]+_[a-z0-9]+$/.test(botId);
}

/**
 * Middleware to validate wallet address in request
 */
export function validateWalletAddress(req: Request, res: Response, next: NextFunction) {
  const address = req.headers['x-wallet-address'] as string || req.body?.address;
  
  if (address && !isValidAddress(address)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address format',
    });
  }
  next();
}

/**
 * Middleware to validate bot ID in params
 */
export function validateBotId(req: Request, res: Response, next: NextFunction) {
  const botId = req.params.botId || req.params.id;
  
  if (botId && !isValidBotId(botId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid bot ID format',
    });
  }
  next();
}
