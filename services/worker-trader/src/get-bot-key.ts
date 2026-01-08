import { prisma } from './lib/prisma';
import { decryptPrivateKey } from '@botmarket/shared';

async function main() {
  const bot = await prisma.bot.findUnique({
    where: { botId: 'bot_1765864576702_9mdsy64' },
    include: { keys: true },
  });

  if (!bot || !bot.keys || bot.keys.length === 0) {
    console.log('Bot or keys not found');
    return;
  }

  const encryptionSecret = process.env.BOT_KEY_ENCRYPTION_SECRET || 'default-secret-change-in-production';
  const privateKey = decryptPrivateKey(bot.keys[0].encryptedPrivKey, encryptionSecret);
  
  console.log('\n🔐 Bot Wallet Details:\n');
  console.log('  Address:     ', bot.keys[0].publicAddress);
  console.log('  Private Key: ', privateKey);
  console.log('\n⚠️  Keep this private key safe! Anyone with it can control this wallet.\n');
  
  await prisma.$disconnect();
}

main();
