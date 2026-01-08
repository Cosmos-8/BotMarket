import { prisma } from './lib/prisma';

async function main() {
  const orders = await prisma.order.findMany({
    where: { botId: 'bot_1765864576702_9mdsy64' },
    orderBy: { placedAt: 'desc' },
    take: 5,
  });
  
  console.log('\n📋 Recent Orders for your bot:\n');
  for (const order of orders) {
    const status = order.status === 'PENDING' ? '🟡 LIVE' : order.status === 'FILLED' ? '🟢 FILLED' : '🔴 ' + order.status;
    console.log(`  ${status}`);
    console.log(`  Order ID: ${order.orderId || 'N/A'}`);
    console.log(`  Side:     ${order.side} ${order.outcome}`);
    console.log(`  Size:     $${order.size}`);
    console.log(`  Price:    $${order.price}`);
    console.log(`  Time:     ${order.placedAt.toISOString()}`);
    console.log('  ---');
  }
  
  await prisma.$disconnect();
}

main();
