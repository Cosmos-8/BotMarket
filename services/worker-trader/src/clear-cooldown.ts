import { prisma } from './lib/prisma';
async function main() {
  const result = await prisma.order.deleteMany({
    where: {
      botId: 'bot_1765864576702_9mdsy64',
      placedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
  console.log('Deleted', result.count, 'recent orders');
  await prisma.$disconnect();
}
main();
