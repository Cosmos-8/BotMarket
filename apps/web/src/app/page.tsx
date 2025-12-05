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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            No-Code Polymarket
            <span className="block gradient-text">Trading Bots</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create automated trading bots for Polymarket prediction markets.
            Connect your TradingView strategy, configure your risk, and let the bot trade for you.
          </p>

          {/* Wallet Status Banner */}
          {isConnected ? (
            <div className="inline-flex items-center px-4 py-2 mb-10 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-2 h-2 mr-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-emerald-300 text-sm">
                Connected as <code className="font-mono text-emerald-200">{shortAddress}</code>
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center px-4 py-2 mb-10 bg-white/5 border border-white/10 rounded-full">
              <span className="text-zinc-400 text-sm">
                Connect your wallet to get started →
              </span>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/create"
              className="inline-flex items-center justify-center px-8 py-4 bg-accent text-white text-lg font-semibold rounded-xl hover:bg-accent-hover transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-[1.02]"
            >
              🤖 Create Your First Bot
            </Link>
              <Link
              href="/marketplace"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/5 text-white text-lg font-semibold rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              📊 Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Onchain Section */}
        <div className="mb-20">
          <div className="bg-gradient-to-r from-accent/20 via-blue-500/10 to-purple-500/10 rounded-2xl p-[1px]">
            <div className="bg-dark-700 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">⛓️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Built on Base</h3>
                    <p className="text-zinc-400 text-sm">
                      Bot registry deployed on Base Mainnet
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {hasContract && BOT_REGISTRY_ADDRESS ? (
                    <>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 mb-1">BotRegistry Contract</p>
                        <code className="font-mono text-accent text-sm">
                          {formatAddress(BOT_REGISTRY_ADDRESS)}
                        </code>
                      </div>
                      <a
                        href={getContractUrl(BOT_REGISTRY_ADDRESS)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
                      >
                        View on BaseScan ↗
                      </a>
                    </>
                  ) : (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Contract Status</p>
                      <p className="text-sm text-amber-400">Not yet deployed</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          <div className="bg-dark-700 p-6 rounded-xl border border-white/5 hover:border-accent/30 transition-colors group">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <span className="text-2xl">📈</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              TradingView Integration
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Connect any TradingView strategy via webhooks. Your alerts trigger
              automatic trades on Polymarket.
            </p>
          </div>

          <div className="bg-dark-700 p-6 rounded-xl border border-white/5 hover:border-accent/30 transition-colors group">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Auto Market Discovery
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Bot automatically finds the right Polymarket for your currency and
              timeframe. No manual setup needed.
            </p>
          </div>

          <div className="bg-dark-700 p-6 rounded-xl border border-white/5 hover:border-accent/30 transition-colors group">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <span className="text-2xl">🛡️</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Built-in Risk Controls
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Configure position limits, cooldowns, and max trades per day.
              Stay in control of your exposure.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-dark-700 rounded-2xl p-8 md:p-12 border border-white/5">
          <h2 className="text-2xl font-bold text-white mb-10 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Connect Wallet', desc: 'Connect your Base wallet to get started' },
              { step: 2, title: 'Create Bot', desc: 'Choose market, timeframe, and risk settings' },
              { step: 3, title: 'Connect TradingView', desc: 'Add webhook URL to your alerts' },
              { step: 4, title: 'Watch It Trade', desc: 'Bot executes trades and tracks performance' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-accent/30">
                  {item.step}
                </div>
                <h4 className="font-semibold text-white mb-2">{item.title}</h4>
                <p className="text-sm text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 text-center">
          <Link
            href="/tradingview-setup"
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            📚 Read the TradingView Setup Guide →
          </Link>
        </div>
      </main>
    </div>
  );
}
