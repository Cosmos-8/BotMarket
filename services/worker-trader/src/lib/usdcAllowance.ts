/**
 * USDC Allowance Manager
 * 
 * Handles automatic USDC allowance approval for the Polymarket CTF Exchange.
 * This allows bots to trade without users needing to manually approve contracts.
 */

import { ethers } from 'ethers';

// Contract addresses on Polygon
// Polymarket uses USDC.e (bridged USDC), NOT native USDC!
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (Polymarket's collateral)
const CTF_EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'; // Polymarket CTF Exchange

// Minimal ERC20 ABI for allowance operations
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

// Polygon RPC endpoint
const POLYGON_RPC = 'https://polygon-rpc.com';

// Console colors for logging
const COLORS = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

/**
 * Check if USDC allowance is sufficient for the CTF Exchange.
 * 
 * @param walletAddress - The wallet address to check
 * @returns Object with balance, allowance, and whether approval is needed
 */
export async function checkUsdcAllowance(walletAddress: string): Promise<{
  balance: bigint;
  allowance: bigint;
  needsApproval: boolean;
}> {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  
  const [balance, allowance] = await Promise.all([
    usdc.balanceOf(walletAddress),
    usdc.allowance(walletAddress, CTF_EXCHANGE_ADDRESS),
  ]);
  
  // Needs approval if balance > 0 but allowance is insufficient
  const needsApproval = balance > 0n && allowance < balance;
  
  return {
    balance,
    allowance,
    needsApproval,
  };
}

/**
 * Set unlimited USDC allowance for the CTF Exchange.
 * This is a one-time operation per wallet.
 * 
 * @param privateKey - The wallet's private key (hex string)
 * @returns Transaction hash if approval was sent, null if not needed
 */
export async function setUsdcAllowance(privateKey: string): Promise<string | null> {
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const wallet = new ethers.Wallet(normalizedKey, provider);
  
  console.log(`${COLORS.cyan}🔐 Checking USDC allowance for ${wallet.address}...${COLORS.reset}`);
  
  // Check current state
  const { balance, allowance, needsApproval } = await checkUsdcAllowance(wallet.address);
  
  const balanceUsd = Number(balance) / 1e6;
  const allowanceUsd = Number(allowance) / 1e6;
  
  console.log(`${COLORS.cyan}   USDC Balance: $${balanceUsd.toFixed(2)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}   Current Allowance: $${allowanceUsd.toFixed(2)}${COLORS.reset}`);
  
  if (!needsApproval) {
    if (balance === 0n) {
      console.log(`${COLORS.yellow}   ⚠️  No USDC balance - fund wallet first${COLORS.reset}`);
    } else {
      console.log(`${COLORS.green}   ✅ Allowance already sufficient${COLORS.reset}`);
    }
    return null;
  }
  
  // Set unlimited allowance (max uint256)
  console.log(`${COLORS.cyan}📝 Setting unlimited USDC allowance for CTF Exchange...${COLORS.reset}`);
  
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const maxAllowance = ethers.MaxUint256;
  
  try {
    const tx = await usdc.approve(CTF_EXCHANGE_ADDRESS, maxAllowance);
    console.log(`${COLORS.cyan}   Transaction sent: ${tx.hash}${COLORS.reset}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`${COLORS.green}   ✅ Allowance approved! Gas used: ${receipt.gasUsed.toString()}${COLORS.reset}`);
    
    return tx.hash;
  } catch (error: any) {
    console.log(`${COLORS.red}   ❌ Approval failed: ${error.message}${COLORS.reset}`);
    throw error;
  }
}

/**
 * Ensure USDC allowance is set before trading.
 * Call this before submitting an order.
 * 
 * @param privateKey - The wallet's private key
 * @returns true if ready to trade, false if no balance
 */
export async function ensureUsdcAllowance(privateKey: string): Promise<boolean> {
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  
  const { balance, needsApproval } = await checkUsdcAllowance(wallet.address);
  
  if (balance === 0n) {
    return false; // No balance, can't trade
  }
  
  if (needsApproval) {
    await setUsdcAllowance(privateKey);
  }
  
  return true;
}

