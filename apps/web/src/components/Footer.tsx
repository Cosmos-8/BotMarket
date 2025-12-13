'use client';

/**
 * Global Footer Component
 * 
 * Displays branding, contract info, and tech stack.
 */

import {
  BOT_REGISTRY_ADDRESS,
  getContractUrl,
  isContractsConfigured,
  formatAddress,
} from '@/config/contracts';

export function Footer() {
  const hasContract = isContractsConfigured();

  return (
    <footer className="border-t border-white/5 bg-dark-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Branding */}
          <div className="flex items-center space-x-6 text-sm text-zinc-400">
            <span className="flex items-center space-x-2">
              <span className="text-accent">⛓️</span>
              <span>Built on Polygon</span>
            </span>
            <span className="hidden md:inline text-zinc-600">•</span>
            <span className="flex items-center space-x-2">
              <span className="text-green-400">💵</span>
              <span>Powered by USDC</span>
            </span>
            <span className="hidden md:inline text-zinc-600">•</span>
            <span className="flex items-center space-x-2">
              <span className="text-purple-400">📊</span>
              <span>Polymarket-ready</span>
            </span>
          </div>

          {/* Contract Address */}
          {hasContract && BOT_REGISTRY_ADDRESS && (
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-zinc-500">BotRegistry:</span>
              <a
                href={getContractUrl(BOT_REGISTRY_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent hover:text-accent-hover transition-colors"
              >
                {formatAddress(BOT_REGISTRY_ADDRESS)} ↗
              </a>
            </div>
          )}
        </div>

        {/* Bottom text */}
        <div className="mt-6 pt-6 border-t border-white/5 text-center text-xs text-zinc-500">
          <p>MBC25 Hackathon • No-Code Polymarket Trading Bot Builder & Marketplace</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

