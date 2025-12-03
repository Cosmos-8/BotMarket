'use client';

import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';
import {
  BOT_REGISTRY_ADDRESS,
  getContractUrl,
  isContractsConfigured,
  formatAddress,
} from '@/config/contracts';

export default function Home() {
  const { isConnected, shortAddress } = useWallet();
  const hasContract = isContractsConfigured();

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            No-Code Polymarket
            <span className="text-blue-600"> Trading Bots</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create automated trading bots for Polymarket prediction markets.
            Connect your TradingView strategy, configure your risk, and let the bot trade for you.
          </p>

          {/* Wallet Status Banner */}
          {isConnected ? (
            <div className="inline-flex items-center px-4 py-2 mb-8 bg-green-50 border border-green-200 rounded-full">
              <span className="w-2 h-2 mr-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-green-800 text-sm">
                Connected as <code className="font-mono">{shortAddress}</code>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center px-4 py-2 mb-8 bg-gray-100 border border-gray-200 rounded-full">
              <span className="text-gray-600 text-sm">
                Connect your wallet to get started →
              </span>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
            >
              🤖 Create Your First Bot
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 text-lg font-medium rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition"
            >
              📊 Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Onchain Section */}
        <div className="mb-16">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-8 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⛓️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Built on Base</h3>
                  <p className="text-blue-100 text-sm">
                    Bot registry deployed on Base Sepolia testnet
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {hasContract && BOT_REGISTRY_ADDRESS ? (
                  <>
                    <div className="text-right">
                      <p className="text-xs text-blue-200">BotRegistry Contract</p>
                      <code className="font-mono text-sm">
                        {formatAddress(BOT_REGISTRY_ADDRESS)}
                      </code>
                    </div>
                    <a
                      href={getContractUrl(BOT_REGISTRY_ADDRESS)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition"
                    >
                      View on BaseScan ↗
                    </a>
                  </>
                ) : (
                  <div className="text-right">
                    <p className="text-xs text-blue-200">Contract Status</p>
                    <p className="text-sm text-yellow-200">Not yet deployed</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-3xl mb-4">📈</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              TradingView Integration
            </h3>
            <p className="text-gray-600">
              Connect any TradingView strategy via webhooks. Your alerts trigger
              automatic trades on Polymarket.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Auto Market Discovery
            </h3>
            <p className="text-gray-600">
              Bot automatically finds the right Polymarket for your currency and
              timeframe. No manual setup needed.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-3xl mb-4">🛡️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Built-in Risk Controls
            </h3>
            <p className="text-gray-600">
              Configure position limits, cooldowns, and max trades per day.
              Stay in control of your exposure.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Connect Wallet</h4>
              <p className="text-sm text-gray-600">
                Connect your Base wallet to get started
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Create Bot</h4>
              <p className="text-sm text-gray-600">
                Choose market, timeframe, and risk settings
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Connect TradingView</h4>
              <p className="text-sm text-gray-600">
                Add webhook URL to your TradingView alerts
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Watch It Trade</h4>
              <p className="text-sm text-gray-600">
                Bot executes trades and tracks performance
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 text-center">
          <Link
            href="/tradingview-setup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            📚 Read the TradingView Setup Guide →
          </Link>
        </div>
      </main>
    </div>
  );
}
