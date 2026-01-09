import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { prisma } from '../lib/prisma';
import { getAddress, isAddress, Wallet, JsonRpcProvider, Contract, parseUnits, formatUnits, keccak256, toUtf8Bytes, concat } from 'ethers';
import { encryptPrivateKey, decryptPrivateKey } from '@botmarket/shared';

const router: IRouter = Router();

// ============================================================================
// Constants
// ============================================================================

const MAX_FUND_AMOUNT = 1_000_000; // Max $1M per transaction
const MIN_FUND_AMOUNT = 0.01;      // Min $0.01
const MIN_WITHDRAW_AMOUNT = 0.01;  // Min $0.01 for withdrawal

// USDC Contracts on Polygon Mainnet
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC
const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // Bridged USDC.e (Polymarket uses this!)
const USDC_DECIMALS = 6;

// Simple cache to avoid hitting blockchain on every request
const balanceCache = new Map<string, { balance: number; timestamp: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds cache

// USDC ABI (minimal - just transfer function)
const USDC_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// ============================================================================
// Logging Helpers
// ============================================================================

function logFund(address: string, amount: number, newBalance: number): void {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`💵 FUND BALANCE: +${amount} USDC for ${shortAddr} → New balance: ${newBalance.toFixed(2)} USDC`);
}

function logBalance(address: string, balance: number): void {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`💰 GET BALANCE: ${shortAddr} → ${balance.toFixed(2)} USDC`);
}

function logWithdraw(from: string, to: string, amount: number, txHash: string): void {
  const shortFrom = `${from.slice(0, 6)}...${from.slice(-4)}`;
  const shortTo = `${to.slice(0, 6)}...${to.slice(-4)}`;
  console.log(`💸 WITHDRAW: $${amount.toFixed(2)} USDC from ${shortFrom} → ${shortTo} | TX: ${txHash}`);
}

/**
 * Create a deterministic proxy wallet for a user.
 * This wallet is derived from the user's address, so it can be recovered after database resets.
 * This is their "main pool" wallet on Polygon for Polymarket trading.
 */
async function ensureProxyWallet(userId: string, polygonAddress: string): Promise<{ address: string; isNew: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { proxyWalletAddress: true, encryptedProxyKey: true },
  });

  // Return existing wallet if present
  if (user?.proxyWalletAddress && user?.encryptedProxyKey) {
    return { address: user.proxyWalletAddress, isNew: false };
  }

  // Generate deterministic proxy wallet from user's address
  // This ensures the same wallet is always generated for the same user address
  const seedSecret = process.env.PROXY_WALLET_SEED_SECRET || 'botmarket-proxy-wallet-seed-v1';
  const seed = keccak256(concat([toUtf8Bytes(seedSecret), toUtf8Bytes(polygonAddress.toLowerCase())]));
  
  // Use the seed as a private key (it's already a valid 32-byte hash)
  // Ensure it's a valid private key by taking modulo of secp256k1 order
  // For simplicity, we'll use the seed directly as it's already 32 bytes
  const privateKey = seed; // keccak256 output is 32 bytes, valid for private key
  
  const proxyWallet = new Wallet(privateKey);
  const proxyAddress = proxyWallet.address;
  const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
  const encryptedKey = encryptPrivateKey(proxyWallet.privateKey, encryptionSecret);

  // Update user with proxy wallet
  await prisma.user.update({
    where: { id: userId },
    data: {
      proxyWalletAddress: proxyAddress,
      encryptedProxyKey: encryptedKey,
    },
  });

  const shortAddr = `${polygonAddress.slice(0, 6)}...${polygonAddress.slice(-4)}`;
  console.log(`🔐 Created/Recovered proxy wallet for ${shortAddr}: ${proxyAddress}`);

  return { address: proxyAddress, isNew: !user?.proxyWalletAddress };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Sync on-chain USDC balance to database
 * Only checks the proxy wallet balance (trading pool funds)
 * User's connected wallet balance is separate and should not be included
 */
async function syncOnChainBalance(userId: string, proxyWalletAddress: string, userAddress: string, encryptedProxyKey: string, forceSync: boolean = false): Promise<number> {
  // Check cache first (unless force sync)
  const cacheKey = proxyWalletAddress.toLowerCase();
  const cached = balanceCache.get(cacheKey);
  if (!forceSync && cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.balance;
  }

  try {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new JsonRpcProvider(rpcUrl);
    
    // Check both native USDC and USDC.e (bridged) - sum both balances
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, provider);
    const usdceContract = new Contract(USDC_E_ADDRESS, USDC_ABI, provider);

    // Only check proxy wallet on-chain balance (this is the trading pool)
    const [nativeBalance, bridgedBalance] = await Promise.all([
      usdcContract.balanceOf(proxyWalletAddress),
      usdceContract.balanceOf(proxyWalletAddress),
    ]);
    
    const nativeAmount = parseFloat(formatUnits(nativeBalance, USDC_DECIMALS));
    const bridgedAmount = parseFloat(formatUnits(bridgedBalance, USDC_DECIMALS));
    const totalBalance = nativeAmount + bridgedAmount;

    // Update cache
    balanceCache.set(cacheKey, { balance: totalBalance, timestamp: Date.now() });

    // Update database to match proxy wallet's on-chain balance only
    await prisma.user.update({
      where: { id: userId },
      data: {
        usdcBalance: totalBalance,
      },
    });

    console.log(`💰 Synced trading pool balance for ${userAddress}: Proxy wallet (${proxyWalletAddress}) has $${totalBalance.toFixed(2)} USDC (native: $${nativeAmount.toFixed(2)}, USDC.e: $${bridgedAmount.toFixed(2)})`);

    return totalBalance;
  } catch (error: any) {
    console.error('Error syncing on-chain balance:', error);
    throw error;
  }
}

/**
 * GET /balance/:address
 * Get USDC balance for a wallet address on Polygon.
 * Creates user with 0 balance if not exists.
 * Also initializes proxy wallet for Polymarket trading.
 * Automatically syncs on-chain balance if proxy wallet exists.
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const sync = req.query.sync === 'true'; // Optional: ?sync=true to force sync

    // Validate address format
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    // Normalize address (checksum)
    const normalizedAddress = getAddress(address);

    // Find or create user (using Polygon address)
    const user = await prisma.user.upsert({
      where: { polygonAddress: normalizedAddress },
      create: {
        polygonAddress: normalizedAddress,
        usdcBalance: 0,
      },
      update: {}, // No update needed, just ensure exists
    });

    // Ensure user has a proxy wallet for Polymarket trading
    const proxyWallet = await ensureProxyWallet(user.id, normalizedAddress);

    // Refresh user to get latest proxy wallet info
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    // Sync on-chain balance if proxy wallet exists and has a key
    // Use cache unless ?sync=true is passed
    let syncedBalance = updatedUser?.usdcBalance || user.usdcBalance;
    const forceSync = req.query.sync === 'true';
    if (updatedUser?.proxyWalletAddress && updatedUser?.encryptedProxyKey) {
      try {
        syncedBalance = await syncOnChainBalance(updatedUser.id, updatedUser.proxyWalletAddress, normalizedAddress, updatedUser.encryptedProxyKey, forceSync);
      } catch (error) {
        console.warn('Failed to sync on-chain balance, using database value:', error);
        // Continue with database value if sync fails
      }
    }

    logBalance(normalizedAddress, syncedBalance);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: syncedBalance,
        // User's main proxy wallet for Polymarket
        proxyWallet: {
          address: proxyWallet.address,
          network: 'Polygon',
          isNew: proxyWallet.isNew,
          note: 'This is your main trading wallet on Polygon. Deposit USDC here.',
        },
      },
    });
  } catch (error: any) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance',
    });
  }
});

/**
 * POST /balance/sync
 * Sync on-chain USDC balance to database.
 * Checks the proxy wallet's on-chain balance and updates the database.
 * 
 * Body: { address: string }
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    // Validate address
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    // Normalize address
    const normalizedAddress = getAddress(address);

    // Get user
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.proxyWalletAddress || !user.encryptedProxyKey) {
      return res.status(400).json({
        success: false,
        error: 'No proxy wallet found. Please deposit funds first.',
      });
    }

    // Sync on-chain balance (checks both proxy wallet and user's connected wallet)
    const syncedBalance = await syncOnChainBalance(user.id, user.proxyWalletAddress, normalizedAddress, user.encryptedProxyKey);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: syncedBalance,
        message: 'Balance synced from on-chain',
      },
    });
  } catch (error: any) {
    console.error('Error syncing balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync balance',
    });
  }
});

/**
 * POST /balance/fund
 * Record a USDC deposit to wallet balance.
 * In production, this would verify the on-chain transfer first.
 * 
 * Body: { address: string, amount: number }
 */
router.post('/fund', async (req: Request, res: Response) => {
  try {
    const { address, amount } = req.body;

    // Validate address
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a number',
      });
    }

    if (amount < MIN_FUND_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_FUND_AMOUNT} USDC`,
      });
    }

    if (amount > MAX_FUND_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount cannot exceed ${MAX_FUND_AMOUNT.toLocaleString()} USDC`,
      });
    }

    // Normalize address
    const normalizedAddress = getAddress(address);

    // Upsert user and add to balance (using Polygon address)
    const user = await prisma.user.upsert({
      where: { polygonAddress: normalizedAddress },
      create: {
        polygonAddress: normalizedAddress,
        usdcBalance: amount,
      },
      update: {
        usdcBalance: {
          increment: amount,
        },
      },
    });

    logFund(normalizedAddress, amount, user.usdcBalance);

    res.json({
      success: true,
      data: {
        address: normalizedAddress,
        usdcBalance: user.usdcBalance,
        funded: amount,
      },
      message: `Successfully funded ${amount} USDC`,
    });
  } catch (error: any) {
    console.error('Error funding balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fund balance',
    });
  }
});

/**
 * POST /balance/allocate-to-bot
 * Allocate funds from user's pool wallet to a specific bot's wallet.
 * This performs a REAL on-chain USDC.e transfer!
 * 
 * Body: { address: string, botId: string, amount: number }
 */
router.post('/allocate-to-bot', async (req: Request, res: Response) => {
  try {
    const { address, botId, amount } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (!botId) {
      return res.status(400).json({ success: false, error: 'Bot ID required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const normalizedAddress = getAddress(address);

    // Get user with proxy wallet info
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has a proxy wallet with funds
    if (!user.proxyWalletAddress || !user.encryptedProxyKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'No pool wallet found. Please deposit funds to your pool first.' 
      });
    }

    // Get bot and verify ownership
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: { 
        metrics: true,
        keys: { take: 1 },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    if (bot.creator.toLowerCase() !== normalizedAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'You can only fund your own bots' });
    }

    // Get bot's wallet address
    if (!bot.keys || bot.keys.length === 0 || !bot.keys[0].encryptedPrivKey) {
      return res.status(400).json({ success: false, error: 'Bot wallet not found' });
    }

    // Decrypt user's pool wallet key
    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
    let userPoolPrivateKey: string;
    try {
      userPoolPrivateKey = decryptPrivateKey(user.encryptedProxyKey, encryptionSecret);
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to decrypt pool wallet' });
    }

    // Get bot's wallet address by decrypting its key
    let botWalletAddress: string;
    try {
      const botPrivateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
      const botWallet = new Wallet(botPrivateKey);
      botWalletAddress = botWallet.address;
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to get bot wallet address' });
    }

    // Setup provider and wallet
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new JsonRpcProvider(rpcUrl);
    const userPoolWallet = new Wallet(userPoolPrivateKey, provider);

    // Use USDC.e (bridged USDC that Polymarket uses)
    const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const usdceContract = new Contract(USDC_E_ADDRESS, USDC_ABI, userPoolWallet);

    // Check user's on-chain USDC.e balance
    const onChainBalance = await usdceContract.balanceOf(userPoolWallet.address);
    const onChainBalanceFormatted = parseFloat(formatUnits(onChainBalance, USDC_DECIMALS));

    if (onChainBalanceFormatted < amount) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient on-chain balance. Pool has $${onChainBalanceFormatted.toFixed(2)} USDC.e but tried to allocate $${amount.toFixed(2)}` 
      });
    }

    // Perform the on-chain transfer!
    console.log(`💸 ALLOCATE (on-chain): $${amount} from pool ${userPoolWallet.address.slice(0,10)}... to bot ${botWalletAddress.slice(0,10)}...`);
    
    const amountWei = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const tx = await usdceContract.transfer(botWalletAddress, amountWei);
    const receipt = await tx.wait();

    console.log(`✅ ALLOCATE SUCCESS: TX ${receipt.hash}`);

    // Clear balance cache so next request gets fresh data
    balanceCache.delete(userPoolWallet.address.toLowerCase());

    // Update database after successful on-chain transfer
    await prisma.$transaction([
      // Update user's database balance to reflect on-chain state
      prisma.user.update({
        where: { polygonAddress: normalizedAddress },
        data: { usdcBalance: onChainBalanceFormatted - amount },
      }),
      // Update bot metrics
      prisma.botMetrics.upsert({
        where: { botId },
        create: {
          botId,
          pnlUsd: amount,
          roiPct: 0,
          trades: 0,
          winRate: 0,
          maxDrawdown: 0,
        },
        update: {
          pnlUsd: { increment: amount },
        },
      }),
    ]);

    // Get updated on-chain balance
    const newOnChainBalance = await usdceContract.balanceOf(userPoolWallet.address);
    const newBalanceFormatted = parseFloat(formatUnits(newOnChainBalance, USDC_DECIMALS));

    res.json({
      success: true,
      data: {
        allocated: amount,
        userBalance: newBalanceFormatted,
        botId,
        botWalletAddress,
        txHash: receipt.hash,
      },
      message: `Successfully transferred $${amount.toFixed(2)} USDC.e to bot wallet on-chain!`,
    });
  } catch (error: any) {
    console.error('Error allocating to bot:', error);
    
    // Provide more helpful error messages
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient POL/MATIC for gas fees in pool wallet' 
      });
    }
    
    res.status(500).json({ success: false, error: error.message || 'Failed to allocate funds' });
  }
});

/**
 * GET /balance/bot/:botId
 * Get allocated balance for a specific bot, plus real-time on-chain USDC balance.
 */
router.get('/bot/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: { 
        metrics: true,
        keys: {
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    // Get on-chain USDC balance if bot has a key
    let onChainBalance = 0;
    let walletAddress: string | null = null;
    
    if (bot.keys && bot.keys.length > 0 && bot.keys[0].encryptedPrivKey) {
      try {
        const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
        const privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
        const wallet = new Wallet(privateKey);
        walletAddress = wallet.address;
        
        // Get on-chain balance (check both USDC and USDC.e)
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new JsonRpcProvider(rpcUrl);
        
        // Check native USDC
        const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, provider);
        const usdcBalance = await usdcContract.balanceOf(walletAddress);
        const usdcAmount = parseFloat(formatUnits(usdcBalance, USDC_DECIMALS));
        
        // Check bridged USDC.e (Polymarket uses this!)
        const usdceContract = new Contract(USDC_E_ADDRESS, USDC_ABI, provider);
        const usdceBalance = await usdceContract.balanceOf(walletAddress);
        const usdceAmount = parseFloat(formatUnits(usdceBalance, USDC_DECIMALS));
        
        // Return total of both
        onChainBalance = usdcAmount + usdceAmount;
      } catch (err) {
        console.error(`Failed to get on-chain balance for bot ${botId}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        botId,
        allocatedBalance: bot.metrics?.pnlUsd || 0, // pnlUsd stores allocated balance
        onChainBalance, // Real-time USDC balance on Polygon
        walletAddress,
      },
    });
  } catch (error: any) {
    console.error('Error getting bot balance:', error);
    res.status(500).json({ success: false, error: 'Failed to get bot balance' });
  }
});

/**
 * POST /balance/withdraw
 * Withdraw USDC from main platform balance (proxy wallet -> user wallet)
 * 
 * Body: { address: string, amount: number, toAddress: string }
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { address, amount, toAddress } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid from address' });
    }

    if (!toAddress || !isAddress(toAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid to address' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < MIN_WITHDRAW_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_WITHDRAW_AMOUNT} USDC`,
      });
    }

    const normalizedAddress = getAddress(address);
    const normalizedToAddress = getAddress(toAddress);

    // Get user and check balance
    const user = await prisma.user.findUnique({
      where: { polygonAddress: normalizedAddress },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.proxyWalletAddress || !user.encryptedProxyKey) {
      return res.status(400).json({
        success: false,
        error: 'No proxy wallet found. Please deposit funds first.',
      });
    }

    if (user.usdcBalance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You have $${user.usdcBalance.toFixed(2)} but tried to withdraw $${amount.toFixed(2)}`,
      });
    }

    // Decrypt proxy wallet private key
    const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(user.encryptedProxyKey, encryptionSecret);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Failed to decrypt wallet key',
      });
    }

    // Get RPC provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const provider = new JsonRpcProvider(rpcUrl);

    // Create wallet and USDC contract
    const wallet = new Wallet(privateKey, provider);
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, wallet);

    // Check on-chain balance
    const onChainBalance = await usdcContract.balanceOf(wallet.address);
    const onChainBalanceFormatted = parseFloat(formatUnits(onChainBalance, USDC_DECIMALS));

    if (onChainBalanceFormatted < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient on-chain balance. Wallet has $${onChainBalanceFormatted.toFixed(2)} USDC`,
      });
    }

    // Transfer USDC
    const amountWei = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const tx = await usdcContract.transfer(normalizedToAddress, amountWei);
    const receipt = await tx.wait();

    // Update database balance
    const updatedUser = await prisma.user.update({
      where: { polygonAddress: normalizedAddress },
      data: {
        usdcBalance: {
          decrement: amount,
        },
      },
    });

    logWithdraw(wallet.address, normalizedToAddress, amount, receipt.hash);

    res.json({
      success: true,
      data: {
        txHash: receipt.hash,
        amount,
        from: wallet.address,
        to: normalizedToAddress,
        newBalance: updatedUser.usdcBalance,
      },
      message: `Successfully withdrew ${amount} USDC`,
    });
  } catch (error: any) {
    console.error('Error withdrawing balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to withdraw balance',
    });
  }
});

/**
 * POST /balance/bot/:botId/withdraw
 * Withdraw USDC from bot balance
 * 
 * Options:
 * 1. Withdraw to main trading pool (internal transfer - no on-chain)
 * 2. Withdraw to user wallet (on-chain transfer)
 * 
 * Body: { address: string, amount: number, toAddress?: string, toPool?: boolean }
 * - If toPool is true: internal transfer to user's main pool (no on-chain)
 * - If toPool is false or undefined: on-chain transfer to toAddress (or address if not provided)
 */
router.post('/bot/:botId/withdraw', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { address, amount, toAddress, toPool } = req.body;

    // Validate inputs
    if (!address || !isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (amount < MIN_WITHDRAW_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${MIN_WITHDRAW_AMOUNT} USDC`,
      });
    }

    const normalizedAddress = getAddress(address);
    
    // Determine destination
    const withdrawToPool = toPool === true;
    const destinationAddress = withdrawToPool ? normalizedAddress : (toAddress ? getAddress(toAddress) : normalizedAddress);
    
    // Validate toAddress only if not withdrawing to pool
    if (!withdrawToPool) {
      if (!destinationAddress || !isAddress(destinationAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid to address' });
      }
    }

    // Get bot and verify ownership
    const bot = await prisma.bot.findUnique({
      where: { botId },
      include: {
        metrics: true,
        keys: {
          take: 1,
        },
      },
    });

    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }

    if (bot.creator.toLowerCase() !== normalizedAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'You can only withdraw from your own bots',
      });
    }

    const botBalance = bot.metrics?.pnlUsd || 0;
    
    // For pool withdrawals, check database balance
    // For wallet withdrawals, we'll check on-chain balance later
    if (withdrawToPool && botBalance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient bot balance. Bot has $${botBalance.toFixed(2)} but tried to withdraw $${amount.toFixed(2)}`,
      });
    }

    if (withdrawToPool) {
      // Internal transfer to main pool (no on-chain transaction needed)
      const user = await prisma.user.findUnique({
        where: { polygonAddress: normalizedAddress },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Update balances in a transaction
      const [updatedMetrics, updatedUser] = await prisma.$transaction([
        // Deduct from bot
        prisma.botMetrics.update({
          where: { botId },
          data: {
            pnlUsd: {
              decrement: amount,
            },
          },
        }),
        // Add to user's main pool
        prisma.user.update({
          where: { polygonAddress: normalizedAddress },
          data: {
            usdcBalance: {
              increment: amount,
            },
          },
        }),
      ]);

      console.log(`💸 WITHDRAW TO POOL: $${amount} from bot ${botId} → user pool`);

      res.json({
        success: true,
        data: {
          amount,
          toPool: true,
          newBotBalance: updatedMetrics.pnlUsd,
          newPoolBalance: updatedUser.usdcBalance,
        },
        message: `Successfully transferred ${amount} USDC from bot to your trading pool`,
      });
    } else {
      // On-chain transfer to wallet
      if (!bot.keys || bot.keys.length === 0 || !bot.keys[0].encryptedPrivKey) {
        return res.status(400).json({
          success: false,
          error: 'Bot wallet not found',
        });
      }

      // Decrypt bot wallet private key
      const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
      let privateKey: string;
      try {
        privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: 'Failed to decrypt bot wallet key',
        });
      }

      // Get RPC provider
      const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
      const provider = new JsonRpcProvider(rpcUrl);

      // Create wallet and check both USDC and USDC.e contracts
      const wallet = new Wallet(privateKey, provider);
      const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, wallet);
      const usdceContract = new Contract(USDC_E_ADDRESS, USDC_ABI, wallet);

      // Check on-chain balance for both native USDC and USDC.e
      const [nativeBalance, bridgedBalance] = await Promise.all([
        usdcContract.balanceOf(wallet.address),
        usdceContract.balanceOf(wallet.address),
      ]);
      
      const nativeAmount = parseFloat(formatUnits(nativeBalance, USDC_DECIMALS));
      const bridgedAmount = parseFloat(formatUnits(bridgedBalance, USDC_DECIMALS));
      const totalBalance = nativeAmount + bridgedAmount;

      if (totalBalance < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient on-chain balance. Bot wallet has $${totalBalance.toFixed(2)} USDC (native: $${nativeAmount.toFixed(2)}, USDC.e: $${bridgedAmount.toFixed(2)})`,
        });
      }

      // Prefer USDC.e for withdrawal (Polymarket compatibility), fallback to native USDC
      const amountWei = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
      let tx;
      let tokenUsed: string;
      
      if (bridgedAmount >= amount) {
        // Use USDC.e
        tx = await usdceContract.transfer(destinationAddress, amountWei);
        tokenUsed = 'USDC.e';
      } else if (nativeAmount >= amount) {
        // Use native USDC
        tx = await usdcContract.transfer(destinationAddress, amountWei);
        tokenUsed = 'USDC';
      } else {
        // Need to use both - not supported in single tx, use the one with more balance
        if (bridgedAmount > nativeAmount) {
          tx = await usdceContract.transfer(destinationAddress, parseUnits(bridgedAmount.toFixed(USDC_DECIMALS), USDC_DECIMALS));
          tokenUsed = 'USDC.e (partial)';
        } else {
          tx = await usdcContract.transfer(destinationAddress, parseUnits(nativeAmount.toFixed(USDC_DECIMALS), USDC_DECIMALS));
          tokenUsed = 'USDC (partial)';
        }
      }
      
      console.log(`💸 WITHDRAW: $${amount} ${tokenUsed} from bot ${botId} → ${destinationAddress.slice(0,10)}...`);
      const receipt = await tx.wait();

      // Update database balance
      const updatedMetrics = await prisma.botMetrics.update({
        where: { botId },
        data: {
          pnlUsd: {
            decrement: amount,
          },
        },
      });

      logWithdraw(wallet.address, destinationAddress, amount, receipt.hash);

      res.json({
        success: true,
        data: {
          txHash: receipt.hash,
          amount,
          from: wallet.address,
          to: destinationAddress,
          toPool: false,
          newBotBalance: updatedMetrics.pnlUsd,
        },
        message: `Successfully withdrew ${amount} USDC from bot to your wallet`,
      });
    }
  } catch (error: any) {
    console.error('Error withdrawing from bot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to withdraw from bot',
    });
  }
});

export default router;
