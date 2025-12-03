import { Router, Request, Response } from 'express';
import { getAddress } from 'ethers';

const router = Router();

/**
 * POST /auth/siwe
 * Generate SIWE message for signing
 */
router.post('/siwe', (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'Address is required',
    });
  }

  try {
    const normalizedAddress = getAddress(address);
    const domain = process.env.SIWE_DOMAIN || 'localhost';
    const origin = process.env.SIWE_ORIGIN || 'http://localhost:3001';
    const statement = 'Sign in to BotMarket';
    const nonce = Math.random().toString(36).substring(2, 15);
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours

    const message = `${domain} wants you to sign in with your Ethereum account:
${normalizedAddress}

${statement}

URI: ${origin}
Version: 1
Chain ID: ${process.env.BASE_CHAIN_ID || 84532}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;

    // Store nonce in session/redis for verification
    // TODO: Store nonce with expiration

    res.json({
      success: true,
      data: {
        message,
        nonce,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid address',
    });
  }
});

/**
 * POST /auth/verify
 * Verify SIWE signature
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { message, signature } = req.body;

  if (!message || !signature) {
    return res.status(400).json({
      success: false,
      error: 'Message and signature are required',
    });
  }

  try {
    const { verifyMessage } = await import('ethers');
    const address = verifyMessage(message, signature);

    // TODO: Verify nonce, expiration, domain, etc.
    // TODO: Create/update user session

    res.json({
      success: true,
      data: {
        address,
        // TODO: Return session token
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid signature',
    });
  }
});

export default router;

