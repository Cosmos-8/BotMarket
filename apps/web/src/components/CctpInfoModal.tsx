'use client';

/**
 * CCTP Info Modal Component
 * 
 * Explains how Circle's CCTP bridges USDC from Base to Polygon for Polymarket.
 */

import { useState } from 'react';

// ============================================================================
// Bridging Steps
// ============================================================================

const BRIDGING_STEPS = [
  {
    step: 1,
    icon: '💰',
    title: 'Fund on Base',
    description: 'User funds their USDC trading balance on Base network. This is the source chain where your wallet holds USDC.',
  },
  {
    step: 2,
    icon: '🔄',
    title: 'CCTP Bridge',
    description: "Circle's Cross-Chain Transfer Protocol (CCTP) burns USDC on Base and mints equivalent USDC on Polygon — fully backed 1:1.",
  },
  {
    step: 3,
    icon: '📊',
    title: 'Polymarket Collateral',
    description: 'Polygon USDC becomes collateral for Polymarket positions. Your bot can now trade YES/NO outcome tokens.',
  },
];

// ============================================================================
// Component
// ============================================================================

interface CctpInfoModalProps {
  className?: string;
}

export function CctpInfoModal({ className = '' }: CctpInfoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Link */}
      <button
        onClick={() => setIsOpen(true)}
        className={`text-xs text-accent hover:text-accent-hover transition-colors inline-flex items-center space-x-1 ${className}`}
      >
        <span>🔗</span>
        <span className="underline underline-offset-2">How bridging works</span>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative bg-dark-700 border border-accent/30 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-accent/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <span className="text-xl">⛓️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">USDC Bridging</h2>
                  <p className="text-xs text-zinc-400">Base → Polygon via Circle CCTP</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-6">
              {BRIDGING_STEPS.map((step, index) => (
                <div key={step.step} className="relative">
                  {/* Connector Line */}
                  {index < BRIDGING_STEPS.length - 1 && (
                    <div className="absolute left-5 top-12 w-0.5 h-8 bg-accent/20" />
                  )}
                  
                  <div className="flex items-start space-x-3">
                    {/* Step Number */}
                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{step.icon}</span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-accent">Step {step.step}</span>
                        <span className="text-sm font-semibold text-white">{step.title}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-[#2775CA]/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#2775CA]">$</span>
                  </div>
                  <span className="text-xs text-zinc-400">Powered by Circle USDC</span>
                </div>
                <a
                  href="https://www.circle.com/en/cross-chain-transfer-protocol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Learn more ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CctpInfoModal;

