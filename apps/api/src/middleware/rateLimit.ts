import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Limits: 200 requests per minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

/**
 * Strict rate limiter for sensitive endpoints
 * Limits: 60 requests per minute per IP (increased for development)
 * Used for: authentication, wallet operations, trading
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per window
  message: {
    success: false,
    error: 'Too many requests to this endpoint. Please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Webhook rate limiter
 * Limits: 30 requests per minute per IP
 * Used for: TradingView webhooks, external signals
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message: {
    success: false,
    error: 'Too many webhook requests. Please check your signal frequency.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth rate limiter - very strict
 * Limits: 5 requests per minute per IP
 * Used for: login, wallet connection, key export
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait before trying again.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
