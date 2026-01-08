import { createOrDeriveApiCredentials, getWalletAddressFromKey } from './lib/polymarketL1Auth';
import { decryptPrivateKey } from '@botmarket/shared';
import { prisma } from './lib/prisma';

async function main() {
  console.log('Testing API credential derivation...');
  
  // Get the bot's encrypted private key
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
  const address = getWalletAddressFromKey(privateKey);
  
  console.log('Wallet address:', address);
  console.log('Attempting to create/derive API credentials...');
  
  try {
    const creds = await createOrDeriveApiCredentials(privateKey);
    console.log('SUCCESS! Got credentials:');
    console.log('  API Key:', creds.apiKey.substring(0, 8) + '...');
    console.log('  Secret:', creds.secret.substring(0, 8) + '...');
    console.log('  Passphrase:', creds.passphrase.substring(0, 8) + '...');
  } catch (error: any) {
    console.error('ERROR:', error.message);
  }
  
  await prisma.$disconnect();
}

main();
