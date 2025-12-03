import { Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'ethers';

export interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
  };
}

/**
 * Middleware to verify wallet signature
 * For MVP, we'll use a simple signature verification
 * TODO: Implement full SIWE flow
 */
export async function verifyWallet(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers['x-signature'] as string;
    const address = req.headers['x-address'] as string;
    const message = req.headers['x-message'] as string;

    if (!signature || !address || !message) {
      return res.status(401).json({
        success: false,
        error: 'Missing authentication headers',
      });
    }

    // Verify signature
    const recoveredAddress = verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    req.user = { address: recoveredAddress };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication - doesn't fail if not present
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers['x-signature'] as string;
    const address = req.headers['x-address'] as string;
    const message = req.headers['x-message'] as string;

    if (signature && address && message) {
      const recoveredAddress = verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
        req.user = { address: recoveredAddress };
      }
    }
    next();
  } catch (error) {
    // Continue without auth
    next();
  }
}

