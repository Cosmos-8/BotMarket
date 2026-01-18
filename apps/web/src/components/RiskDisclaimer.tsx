'use client';

import { useState } from 'react';

interface RiskDisclaimerProps {
  compact?: boolean;
}

/**
 * Risk Disclaimer Banner
 * Displays important risk warnings for trading activities
 */
export function RiskDisclaimer({ compact = false }: RiskDisclaimerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && compact) return null;

  if (compact) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-amber-400">⚠️</span>
          <span className="text-amber-300 text-sm">
            Trading involves risk. You may lose your entire investment.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-300 text-sm"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 rounded-xl p-6">
      <div className="flex items-start space-x-4">
        <div className="text-3xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Important Risk Disclosure
          </h3>
          <ul className="text-sm text-zinc-300 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>
                <strong className="text-white">Trading prediction markets involves substantial risk of loss.</strong> You can lose some or all of your invested capital.
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>
                <strong className="text-white">Past performance does not guarantee future results.</strong> Historical bot performance may not be replicated.
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>
                <strong className="text-white">This is not financial advice.</strong> BotMarket does not provide investment recommendations.
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>
                Only trade with funds you can afford to lose. Never invest money you need for essential expenses.
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            By using BotMarket, you acknowledge these risks and agree to our{' '}
            <a href="/terms" className="text-accent hover:underline">Terms of Service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RiskDisclaimer;
