'use client';

/**
 * USDC Balance Panel Component
 * 
 * Displays the user's USDC trading balance with quick-fund buttons.
 * Used on Create Bot and Marketplace pages.
 */

import { useWallet } from '@/hooks/useWallet';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// ============================================================================
// Fund Amount Options
// ============================================================================

const FUND_AMOUNTS = [25, 50, 100, 500];

// ============================================================================
// Component
// ============================================================================

export function UsdcBalancePanel() {
  const { isConnected } = useWallet();
  const { balance, isLoading, fund, isFunding, error } = useUsdcBalance();

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">💵</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">USDC Trading Balance</h3>
            <p className="text-sm text-gray-600">Fund your bots with USDC</p>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Connect your wallet to fund your USDC trading balance.
        </p>
        
        <ConnectButton />
        
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          Bots size positions in USDC. In production, this balance would be funded via 
          USDC on Base and bridged to Polygon using Circle's CCTP for Polymarket collateral.
        </p>
      </div>
    );
  }

  // Connected state
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">💵</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">USDC Trading Balance</h3>
            <p className="text-sm text-gray-600">Available for bot trading</p>
          </div>
        </div>
        
        {/* Balance Display */}
        <div className="text-right">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-24 bg-emerald-200 rounded"></div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-emerald-700">
              ${balance.toFixed(2)}
              <span className="text-sm font-normal text-emerald-600 ml-1">USDC</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Fund Buttons */}
      <div className="mb-4">
        <p className="text-xs text-gray-600 mb-2">Quick fund (mock):</p>
        <div className="flex flex-wrap gap-2">
          {FUND_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => fund(amount)}
              disabled={isFunding}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition
                ${isFunding
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                }
              `}
            >
              {isFunding ? '...' : `+$${amount}`}
            </button>
          ))}
        </div>
      </div>

      {/* Circle Bounty Copy */}
      <div className="pt-3 border-t border-emerald-200">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-emerald-700">Powered by USDC.</span>{' '}
          Bots size positions in USDC. In production, this balance would be funded via 
          USDC on Base and bridged to Polygon using{' '}
          <span className="font-medium">Circle's CCTP</span> for Polymarket collateral.
        </p>
      </div>
    </div>
  );
}

export default UsdcBalancePanel;

