'use client';

import { useState } from 'react';

interface EnableTradingProps {
  proxyWalletAddress: string;
  polymarketRegistered: boolean;
  onRegistrationConfirmed: () => void;
  userAddress: string;
}

export function EnableTrading({
  proxyWalletAddress,
  polymarketRegistered,
  onRegistrationConfirmed,
  userAddress,
}: EnableTradingProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(proxyWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleConfirmRegistration = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/balance/confirm-polymarket-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress }),
      });

      const result = await response.json();

      if (result.success) {
        onRegistrationConfirmed();
      } else {
        setError(result.error || 'Failed to confirm registration');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsConfirming(false);
    }
  };

  // If already registered, show success state
  if (polymarketRegistered) {
    return (
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Trading Enabled</h3>
            <p className="text-sm text-emerald-400">Your wallet is registered on Polymarket</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-black/20 rounded-lg">
          <p className="text-xs text-zinc-500 mb-1">Trading Wallet</p>
          <code className="text-sm text-emerald-400 break-all">{proxyWalletAddress}</code>
        </div>
      </div>
    );
  }

  const steps = [
    {
      number: 1,
      title: 'Copy Your Trading Wallet',
      description: 'This is your dedicated BotMarket trading wallet on Polygon.',
      action: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-black/30 rounded-lg border border-white/5">
            <code className="flex-1 text-sm text-purple-400 break-all font-mono">
              {proxyWalletAddress}
            </code>
            <button
              onClick={copyToClipboard}
              className="shrink-0 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
            >
              {copied ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => setCurrentStep(2)}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
          >
            Continue →
          </button>
        </div>
      ),
    },
    {
      number: 2,
      title: 'Import to Wallet App',
      description: 'Add this wallet to Phantom, MetaMask, or your preferred wallet.',
      action: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://phantom.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-center transition-all"
            >
              <span className="text-2xl block mb-1">👻</span>
              <span className="text-xs text-purple-400">Phantom</span>
            </a>
            <a
              href="https://metamask.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-center transition-all"
            >
              <span className="text-2xl block mb-1">🦊</span>
              <span className="text-xs text-orange-400">MetaMask</span>
            </a>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400">
              💡 <strong>Tip:</strong> In your wallet app, look for "Import Account" or "Import Private Key" and paste your trading wallet address.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      ),
    },
    {
      number: 3,
      title: 'Register on Polymarket',
      description: 'Connect your trading wallet to Polymarket and accept their Terms of Service.',
      action: (
        <div className="space-y-3">
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-semibold transition-all text-center"
          >
            🌐 Go to Polymarket →
          </a>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
            <p className="text-xs text-blue-400 font-medium">On Polymarket:</p>
            <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Click "Connect Wallet" in the top right</li>
              <li>Select your wallet app (Phantom, MetaMask, etc.)</li>
              <li>Choose your <strong className="text-purple-400">BotMarket trading wallet</strong></li>
              <li>Accept the Terms of Service</li>
              <li>Complete any verification if required</li>
            </ol>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
            >
              I've Done This →
            </button>
          </div>
        </div>
      ),
    },
    {
      number: 4,
      title: 'Confirm Registration',
      description: 'Let us know you\'ve completed Polymarket registration.',
      action: (
        <div className="space-y-3">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
            <span className="text-4xl block mb-2">🎉</span>
            <p className="text-sm text-emerald-400 font-medium">Almost there!</p>
            <p className="text-xs text-zinc-400 mt-1">
              Make sure you've connected your trading wallet to Polymarket and accepted their Terms of Service.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentStep(3)}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirmRegistration}
              disabled={isConfirming}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Enable Trading</span>
                </>
              )}
            </button>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps.find((s) => s.number === currentStep) || steps[0];

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-purple-600/10 border border-amber-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <span className="text-2xl">⚡</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Enable Trading</h3>
            <p className="text-sm text-zinc-400">Complete setup to start trading on Polymarket</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4 bg-black/10">
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  currentStep > step.number
                    ? 'bg-emerald-500 text-white'
                    : currentStep === step.number
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {currentStep > step.number ? '✓' : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                    currentStep > step.number ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <p
              key={step.number}
              className={`text-xs ${
                currentStep >= step.number ? 'text-zinc-300' : 'text-zinc-600'
              }`}
              style={{ width: `${100 / steps.length}%` }}
            >
              {step.title.split(' ').slice(0, 2).join(' ')}
            </p>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-white mb-1">{currentStepData.title}</h4>
          <p className="text-sm text-zinc-400">{currentStepData.description}</p>
        </div>
        {currentStepData.action}
      </div>
    </div>
  );
}

