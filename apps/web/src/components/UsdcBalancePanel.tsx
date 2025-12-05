'use client';

/**
 * USDC Balance Panel Component
 * 
 * Displays the user's USDC trading balance with quick-fund buttons.
 * Used on Create Bot and Marketplace pages.
 * Dark theme styled with Circle bounty messaging.
 */

import { useWallet } from '@/hooks/useWallet';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CctpInfoModal } from './CctpInfoModal';

// ============================================================================
// Fund Amount Options
// ============================================================================

const FUND_AMOUNTS = [25, 50, 100, 500];

// ============================================================================
// USDC Icon Component
// ============================================================================

function UsdcIcon({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-5 h-5 text-[8px]' : 'w-10 h-10 text-xs';
  
  return (
    <div className={`${sizeClasses} rounded-full bg-[#2775CA] flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-white">$</span>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function UsdcBalancePanel() {
  const { isConnected } = useWallet();
  const { balance, isLoading, fund, isFunding, error } = useUsdcBalance();

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-1">
          <UsdcIcon />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-white">USDC Trading Balance</h3>
              <span className="px-1.5 py-0.5 bg-[#2775CA]/20 text-[#2775CA] text-[10px] font-medium rounded">
                USDC
              </span>
            </div>
            <p className="text-xs text-zinc-500">USDC-denominated balance used for sizing bot positions.</p>
          </div>
        </div>
        
        <p className="text-sm text-zinc-400 mb-4 mt-3">
          Connect your wallet to fund your USDC trading balance.
        </p>
        
        <ConnectButton />
        
        {/* Footer with CCTP messaging */}
        <div className="mt-4 pt-3 border-t border-emerald-500/10 space-y-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            <span className="text-emerald-400">💡</span>{' '}
            In production, this would be funded with USDC on Base and bridged to Polygon via{' '}
            <span className="text-zinc-400 font-medium">Circle&apos;s CCTP</span> for Polymarket collateral.
          </p>
          <CctpInfoModal />
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <UsdcIcon />
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-white">USDC Trading Balance</h3>
              <span className="px-1.5 py-0.5 bg-[#2775CA]/20 text-[#2775CA] text-[10px] font-medium rounded">
                USDC
              </span>
            </div>
            <p className="text-xs text-zinc-500">USDC-denominated balance used for sizing bot positions.</p>
          </div>
        </div>
        
        {/* Balance Display */}
        <div className="text-right">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-24 bg-emerald-500/20 rounded"></div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-emerald-400">
              ${balance.toFixed(2)}
              <span className="text-sm font-normal text-emerald-500/80 ml-1">USDC</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Fund Buttons */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 mb-2">Quick fund (mock):</p>
        <div className="flex flex-wrap gap-2">
          {FUND_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => fund(amount)}
              disabled={isFunding}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition
                ${isFunding
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700'
                }
              `}
            >
              {isFunding ? '...' : `+$${amount}`}
            </button>
          ))}
        </div>
      </div>

      {/* Circle / CCTP Footer */}
      <div className="pt-3 border-t border-emerald-500/10 space-y-2">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          <span className="text-emerald-400">💡</span>{' '}
          In production, this would be funded with USDC on Base and bridged to Polygon via{' '}
          <span className="text-zinc-400 font-medium">Circle&apos;s CCTP</span> for Polymarket collateral.
        </p>
        <CctpInfoModal />
      </div>
    </div>
  );
}

export default UsdcBalancePanel;
