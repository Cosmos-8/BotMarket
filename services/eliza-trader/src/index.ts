import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import polymarketPlugin from './plugins/polymarket/index.ts';
import { character } from './character.ts';

/**
 * Initialize the TraderBot character
 */
const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('🤖 Initializing TraderBot - Polymarket Trading Agent');
  logger.info({ name: character.name }, 'Agent name:');
  
  // Log configuration
  logger.info({
    groq: !!process.env.GROQ_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    twitter: !!process.env.TWITTER_BEARER_TOKEN,
    polymarketWallet: !!process.env.POLYMARKET_WALLET_PRIVATE_KEY,
    polymarketApi: !!process.env.POLYMARKET_BUILDER_API_KEY,
  }, 'Configuration status:');
};

/**
 * TraderBot Project Agent
 */
export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [polymarketPlugin], // Custom Polymarket trading plugin
};

/**
 * ElizaOS Project Configuration
 */
const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';
export { polymarketPlugin } from './plugins/polymarket/index.ts';

export default project;
