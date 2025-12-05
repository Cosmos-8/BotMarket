'use client';

/**
 * Mock Trading Mode Banner
 * 
 * Displays a notice that the app is running in mock/demo mode for the hackathon.
 */

export function MockTradingBanner() {
  return (
    <div className="bg-[#3A2A10] border-b border-[#FACC15]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <p className="text-center text-sm text-amber-200/90">
          <span className="font-medium text-amber-300">⚡ Demo Mode</span>
          <span className="hidden sm:inline mx-2">—</span>
          <span className="hidden sm:inline">
            Trading runs in safe mock mode for the hackathon. In production, this connects to{' '}
            <span className="text-amber-100">Polymarket&apos;s CLOB</span> and{' '}
            <span className="text-amber-100">Circle&apos;s CCTP</span> for USDC bridging.
          </span>
          <span className="sm:hidden"> Safe mock trading for hackathon demo.</span>
        </p>
      </div>
    </div>
  );
}

export default MockTradingBanner;

