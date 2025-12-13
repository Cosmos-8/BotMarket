/**
 * Database Seed Script
 * 
 * Creates demo bots with realistic trading history for hackathon demos.
 * Run with: pnpm db:seed (from apps/api) or pnpm seed (from root)
 * 
 * This script is idempotent - it deletes existing demo data before re-seeding.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

const DEMO_BOT_PREFIX = 'demo_';
const DEMO_CREATOR_ADDRESS = '0x000000000000000000000000000000000000dEm0';

// Demo bot definitions
const DEMO_BOTS = [
  {
    name: 'BTC 15m Trend Follower',
    slug: 'btc_15m_trend',
    currency: 'Bitcoin',
    timeframe: '15m',
    targetRoi: 24.5,
    targetPnl: 156.32,
    targetWinRate: 68,
    tradeCount: 28,
  },
  {
    name: 'ETH 1h Breakout',
    slug: 'eth_1h_breakout',
    currency: 'Ethereum',
    timeframe: '1h',
    targetRoi: 18.2,
    targetPnl: 89.50,
    targetWinRate: 62,
    tradeCount: 22,
  },
  {
    name: 'SOL Daily Mean Reversion',
    slug: 'sol_1d_meanrev',
    currency: 'Solana',
    timeframe: '1d',
    targetRoi: -5.3,
    targetPnl: -42.10,
    targetWinRate: 45,
    tradeCount: 12,
  },
  {
    name: 'BTC 4h Momentum',
    slug: 'btc_4h_momentum',
    currency: 'Bitcoin',
    timeframe: '4h',
    targetRoi: 31.7,
    targetPnl: 203.45,
    targetWinRate: 71,
    tradeCount: 18,
  },
  {
    name: 'XRP 1h Scalper',
    slug: 'xrp_1h_scalper',
    currency: 'XRP',
    timeframe: '1h',
    targetRoi: 8.9,
    targetPnl: 44.50,
    targetWinRate: 58,
    tradeCount: 35,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateConfigHash(config: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomPrice(): number {
  // Realistic prediction market price between 0.35 and 0.75
  return Math.round(randomBetween(0.35, 0.75) * 10000) / 10000;
}

function randomOutcome(): 'YES' | 'NO' {
  return Math.random() > 0.5 ? 'YES' : 'NO';
}

function randomSide(): 'BUY' | 'SELL' {
  return Math.random() > 0.3 ? 'BUY' : 'SELL'; // More buys than sells
}

function generateOrderId(): string {
  return `demo_order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function generateFillId(): string {
  return `demo_fill_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

function generateTokenId(currency: string, outcome: string): string {
  const currencyShort = currency.toLowerCase().substring(0, 3);
  return `${currencyShort}_token_${outcome.toLowerCase()}_${randomInt(1000, 9999)}`;
}

function getRandomPastDate(daysAgo: number): Date {
  const now = new Date();
  const randomMs = randomBetween(0, daysAgo * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - randomMs);
}

function createBotConfig(currency: string, timeframe: string): object {
  return {
    version: '1.0',
    template: 'tradingview-webhook',
    market: {
      currency,
      timeframe,
    },
    webhook: {
      secret: crypto.randomBytes(16).toString('hex'),
      signalMap: {
        LONG: { side: 'BUY', outcome: 'YES' },
        SHORT: { side: 'BUY', outcome: 'NO' },
        CLOSE: { action: 'EXIT' },
      },
    },
    sizing: {
      type: 'fixed_usd',
      value: randomInt(20, 50),
    },
    risk: {
      maxPositionUsd: randomInt(150, 300),
      cooldownMinutes: randomInt(15, 60),
      maxTradesPerDay: randomInt(8, 20),
    },
    execution: {
      orderType: 'limit',
      maxSlippageBps: randomInt(30, 100),
    },
  };
}

function generateMarketId(currency: string, timeframe: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  const hour = date.getHours();
  return `${currency.toLowerCase()}_${timeframe}_${dateStr}_${hour.toString().padStart(2, '0')}`;
}

// ============================================================================
// Seeding Functions
// ============================================================================

async function cleanupDemoData(): Promise<void> {
  console.log('🧹 Cleaning up existing demo data...');
  
  // Find all demo bots
  const demoBots = await prisma.bot.findMany({
    where: {
      botId: {
        startsWith: DEMO_BOT_PREFIX,
      },
    },
    select: { botId: true },
  });

  if (demoBots.length === 0) {
    console.log('   No existing demo data found.');
    return;
  }

  const botIds = demoBots.map(b => b.botId);
  console.log(`   Found ${botIds.length} demo bots to clean up.`);

  // Delete in correct order due to foreign key constraints
  // Fills reference Orders, so delete fills first
  await prisma.fill.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.order.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.signal.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.botMetrics.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.botKey.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.botConfig.deleteMany({
    where: { botId: { in: botIds } },
  });
  
  await prisma.bot.deleteMany({
    where: { botId: { in: botIds } },
  });

  console.log('   ✅ Demo data cleaned up.');
}

async function ensureDemoUser(): Promise<void> {
  console.log('👤 Ensuring demo user exists...');
  
  await prisma.user.upsert({
    where: { polygonAddress: DEMO_CREATOR_ADDRESS },
    create: { polygonAddress: DEMO_CREATOR_ADDRESS },
    update: {},
  });
  
  console.log(`   ✅ Demo user: ${DEMO_CREATOR_ADDRESS}`);
}

async function seedBot(botDef: typeof DEMO_BOTS[0]): Promise<void> {
  const botId = `${DEMO_BOT_PREFIX}${botDef.slug}`;
  const config = createBotConfig(botDef.currency, botDef.timeframe);
  const configHash = generateConfigHash(config);

  console.log(`\n🤖 Creating bot: ${botDef.name}`);
  console.log(`   ID: ${botId}`);

  // Create bot
  const bot = await prisma.bot.create({
    data: {
      botId,
      creator: DEMO_CREATOR_ADDRESS,
      visibility: 'PUBLIC',
      configHash,
      createdAt: getRandomPastDate(14), // Created 0-14 days ago
    },
  });

  // Create config
  await prisma.botConfig.create({
    data: {
      botId,
      configJSON: config,
      version: '1.0',
    },
  });

  // Create orders and fills
  const orders: { id: string; price: number; size: number; outcome: string; isWin: boolean }[] = [];
  
  // Determine how many winning vs losing trades based on win rate
  const winCount = Math.round(botDef.tradeCount * (botDef.targetWinRate / 100));
  const lossCount = botDef.tradeCount - winCount;
  
  // Create array of win/loss outcomes and shuffle
  const outcomes = [
    ...Array(winCount).fill(true),
    ...Array(lossCount).fill(false),
  ].sort(() => Math.random() - 0.5);

  console.log(`   📊 Creating ${botDef.tradeCount} trades (${winCount} wins, ${lossCount} losses)...`);

  for (let i = 0; i < botDef.tradeCount; i++) {
    const placedAt = getRandomPastDate(7); // Orders within last 7 days
    const outcome = randomOutcome();
    const side = randomSide();
    const price = randomPrice();
    const size = randomBetween(15, 50);
    const isWin = outcomes[i];
    
    const marketId = generateMarketId(botDef.currency, botDef.timeframe, placedAt);
    
    const order = await prisma.order.create({
      data: {
        botId,
        placedAt,
        marketId,
        outcome,
        side,
        price,
        size,
        status: 'FILLED',
        orderId: generateOrderId(),
        tokenId: generateTokenId(botDef.currency, outcome),
      },
    });

    orders.push({ id: order.id, price, size, outcome, isWin });

    // Create corresponding fill (slightly after order placement)
    const fillAt = new Date(placedAt.getTime() + randomInt(100, 5000)); // Fill 0.1-5 seconds after
    const fillPrice = price + (Math.random() - 0.5) * 0.02; // Small slippage
    const fees = Math.round(size * randomBetween(0.001, 0.015) * 100) / 100;

    await prisma.fill.create({
      data: {
        botId,
        orderId: order.id,
        fillAt,
        price: Math.max(0.01, Math.min(0.99, fillPrice)),
        size,
        fees,
        fillId: generateFillId(),
      },
    });
  }

  // Create metrics
  await prisma.botMetrics.create({
    data: {
      botId,
      pnlUsd: botDef.targetPnl,
      roiPct: botDef.targetRoi,
      trades: botDef.tradeCount,
      winRate: botDef.targetWinRate,
      maxDrawdown: -Math.abs(botDef.targetPnl * randomBetween(0.1, 0.4)), // Drawdown is 10-40% of PnL
    },
  });

  const roiStr = botDef.targetRoi >= 0 
    ? `\x1b[32m+${botDef.targetRoi.toFixed(1)}%\x1b[0m` 
    : `\x1b[31m${botDef.targetRoi.toFixed(1)}%\x1b[0m`;
  
  const pnlStr = botDef.targetPnl >= 0
    ? `\x1b[32m+$${botDef.targetPnl.toFixed(2)}\x1b[0m`
    : `\x1b[31m$${botDef.targetPnl.toFixed(2)}\x1b[0m`;

  console.log(`   ✅ Bot created | ROI: ${roiStr} | PnL: ${pnlStr} | Win Rate: ${botDef.targetWinRate}%`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('\x1b[1m\x1b[34m╔════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m\x1b[34m║\x1b[0m  🌱 BotMarket Database Seeder                          \x1b[1m\x1b[34m║\x1b[0m');
  console.log('\x1b[1m\x1b[34m╚════════════════════════════════════════════════════════╝\x1b[0m');
  console.log('');

  try {
    // Step 1: Clean up existing demo data
    await cleanupDemoData();

    // Step 2: Ensure demo user exists
    await ensureDemoUser();

    // Step 3: Seed each bot
    for (const botDef of DEMO_BOTS) {
      await seedBot(botDef);
    }

    // Summary
    console.log('');
    console.log('\x1b[1m\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
    console.log('\x1b[1m\x1b[32m✅ SEEDING COMPLETE\x1b[0m');
    console.log('\x1b[1m\x1b[32m════════════════════════════════════════════════════════\x1b[0m');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   • ${DEMO_BOTS.length} demo bots created`);
    console.log(`   • ${DEMO_BOTS.reduce((sum, b) => sum + b.tradeCount, 0)} total trades`);
    console.log(`   • Creator: ${DEMO_CREATOR_ADDRESS}`);
    console.log('');
    console.log('🚀 Demo bots available:');
    
    for (const bot of DEMO_BOTS) {
      const roiColor = bot.targetRoi >= 0 ? '\x1b[32m' : '\x1b[31m';
      const roiSign = bot.targetRoi >= 0 ? '+' : '';
      console.log(`   • ${bot.name.padEnd(28)} ${roiColor}${roiSign}${bot.targetRoi.toFixed(1)}% ROI\x1b[0m`);
    }
    
    console.log('');
    console.log('🌐 View in UI: http://localhost:3000/marketplace');
    console.log('');

  } catch (error) {
    console.error('\x1b[31m❌ Seeding failed:\x1b[0m', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

