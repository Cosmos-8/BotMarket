'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getMarketplace } from '@/lib/api';
import {
  BOT_REGISTRY_ADDRESS,
  getContractUrl,
  isContractsConfigured,
  formatAddress,
} from '@/config/contracts';
import { UsdcBalancePanel } from '@/components/UsdcBalancePanel';

// ============================================================================
// Types & Constants
// ============================================================================

type SortOption = 'roi' | 'pnl' | 'winrate' | 'trades';
type MarketFilter = 'ALL' | 'BTC' | 'ETH' | 'SOL' | 'XRP';
type TimeframeFilter = 'ALL' | '15m' | '1h' | '4h' | '1d';

interface Bot {
  botId: string;
  creator: string;
  visibility: string;
  metrics?: {
    pnlUsd: number;
    roiPct: number;
    trades: number;
    winRate: number;
    maxDrawdown?: number;
  };
  forkCount?: number;
  createdAt: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'roi', label: 'ROI' },
  { value: 'pnl', label: 'PnL' },
  { value: 'winrate', label: 'Win Rate' },
  { value: 'trades', label: 'Trades' },
];

const MARKET_FILTERS: MarketFilter[] = ['ALL', 'BTC', 'ETH', 'SOL', 'XRP'];
const TIMEFRAME_FILTERS: TimeframeFilter[] = ['ALL', '15m', '1h', '4h', '1d'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract market from botId (e.g., "demo_btc_4h_momentum" -> "BTC")
 */
function extractMarket(botId: string): MarketFilter | 'Other' {
  const id = botId.toLowerCase();
  if (id.includes('btc') || id.includes('bitcoin')) return 'BTC';
  if (id.includes('eth') || id.includes('ethereum')) return 'ETH';
  if (id.includes('sol') || id.includes('solana')) return 'SOL';
  if (id.includes('xrp')) return 'XRP';
  return 'Other';
}

/**
 * Extract timeframe from botId (e.g., "demo_btc_4h_momentum" -> "4h")
 */
function extractTimeframe(botId: string): TimeframeFilter | 'Other' {
  const id = botId.toLowerCase();
  if (id.includes('15m')) return '15m';
  if (id.includes('1h')) return '1h';
  if (id.includes('4h')) return '4h';
  if (id.includes('1d')) return '1d';
  return 'Other';
}

/**
 * Format market display name
 */
function getMarketDisplayName(market: MarketFilter | 'Other'): string {
  const names: Record<string, string> = {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    XRP: 'XRP',
    Other: 'Other',
  };
  return names[market] || market;
}

/**
 * Format timeframe display name
 */
function getTimeframeDisplayName(tf: TimeframeFilter | 'Other'): string {
  const names: Record<string, string> = {
    '15m': '15 min',
    '1h': '1 hour',
    '4h': '4 hour',
    '1d': '1 day',
    Other: 'Other',
  };
  return names[tf] || tf;
}

// ============================================================================
// Components
// ============================================================================

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function FilterPill({ label, isActive, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
        isActive
          ? 'bg-accent text-white shadow-lg shadow-accent/20'
          : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
      }`}
    >
      {label}
    </button>
  );
}

interface SortButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function SortButton({ label, isActive, onClick }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        isActive
          ? 'bg-accent text-white'
          : 'bg-dark-600 text-zinc-400 hover:bg-dark-500 hover:text-white border border-white/10'
      }`}
    >
      {label}
      {isActive && <span className="ml-1">↓</span>}
    </button>
  );
}

interface TopPerformerBadgeProps {
  roiPct: number;
}

function TopPerformerBadge({ roiPct }: TopPerformerBadgeProps) {
  if (roiPct <= 20) return null;
  
  return (
    <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-semibold rounded-full border border-amber-500/30 flex items-center gap-1">
      <span className="text-amber-300">⭐</span>
      Top Performer
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MarketplacePage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Client-side sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('roi');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('ALL');

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const result = await getMarketplace({});
      if (result.success) {
        setBots(result.data || []);
      }
    } catch (error) {
      console.error('Error loading bots:', error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering and sorting
  const filteredAndSortedBots = useMemo(() => {
    let result = [...bots];

    // Filter by market
    if (marketFilter !== 'ALL') {
      result = result.filter((bot) => {
        const market = extractMarket(bot.botId);
        return market === marketFilter;
      });
    }

    // Filter by timeframe
    if (timeframeFilter !== 'ALL') {
      result = result.filter((bot) => {
        const tf = extractTimeframe(bot.botId);
        return tf === timeframeFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      const aMetrics = a.metrics || { pnlUsd: 0, roiPct: 0, trades: 0, winRate: 0 };
      const bMetrics = b.metrics || { pnlUsd: 0, roiPct: 0, trades: 0, winRate: 0 };

      switch (sortBy) {
        case 'roi':
          return bMetrics.roiPct - aMetrics.roiPct;
        case 'pnl':
          return bMetrics.pnlUsd - aMetrics.pnlUsd;
        case 'winrate':
          return bMetrics.winRate - aMetrics.winRate;
        case 'trades':
          return bMetrics.trades - aMetrics.trades;
        default:
          return 0;
      }
    });

    return result;
  }, [bots, sortBy, marketFilter, timeframeFilter]);

  const totalBots = bots.length;
  const filteredCount = filteredAndSortedBots.length;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Bot Leaderboard</h1>
          <p className="text-zinc-400">
            Browse and fork top-performing trading bots • {filteredCount} of {totalBots} bots
          </p>
        </div>

        {/* Sorting Controls */}
        <div className="bg-dark-700 border border-white/5 rounded-xl p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Sort By */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">Sort by:</span>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => (
                  <SortButton
                    key={option.value}
                    label={option.label}
                    isActive={sortBy === option.value}
                    onClick={() => setSortBy(option.value)}
                  />
                ))}
              </div>
            </div>

            {/* Filter by Market */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">Market:</span>
              <div className="flex flex-wrap gap-2">
                {MARKET_FILTERS.map((market) => (
                  <FilterPill
                    key={market}
                    label={market}
                    isActive={marketFilter === market}
                    onClick={() => setMarketFilter(market)}
                  />
                ))}
              </div>
            </div>

            {/* Filter by Timeframe */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">Timeframe:</span>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAME_FILTERS.map((tf) => (
                  <FilterPill
                    key={tf}
                    label={tf}
                    isActive={timeframeFilter === tf}
                    onClick={() => setTimeframeFilter(tf)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info Banners Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Contract Info Banner */}
          {isContractsConfigured() && BOT_REGISTRY_ADDRESS && (
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-accent">⛓️</span>
                <span className="text-sm text-zinc-300">
                  BotRegistry:{' '}
                  <code className="font-mono text-accent">{formatAddress(BOT_REGISTRY_ADDRESS)}</code>
                </span>
              </div>
              <a
                href={getContractUrl(BOT_REGISTRY_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:text-accent-hover font-medium transition-colors"
              >
                View on PolygonScan ↗
              </a>
            </div>
          )}
          
          {/* USDC Balance Panel */}
          <UsdcBalancePanel />
        </div>

        {/* Bot Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent"></div>
            <p className="text-zinc-400 mt-4">Loading bots...</p>
          </div>
        ) : filteredAndSortedBots.length === 0 ? (
          <div className="text-center py-20 bg-dark-700 rounded-2xl border border-white/5">
            <div className="text-5xl mb-4">🤖</div>
            {bots.length === 0 ? (
              <>
                <p className="text-zinc-400 mb-6">No bots found in marketplace</p>
                <Link
                  href="/create"
                  className="inline-flex items-center px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                >
                  Create the first bot →
                </Link>
              </>
            ) : (
              <>
                <p className="text-zinc-400 mb-4">No bots match your filters</p>
                <button
                  onClick={() => {
                    setMarketFilter('ALL');
                    setTimeframeFilter('ALL');
                  }}
                  className="text-accent hover:text-accent-hover transition-colors font-medium"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedBots.map((bot, index) => {
              const market = extractMarket(bot.botId);
              const timeframe = extractTimeframe(bot.botId);
              const isTopPerformer = bot.metrics && bot.metrics.roiPct > 20;
              
              return (
                <div
                key={bot.botId}
                  className={`bg-dark-700 rounded-xl border p-6 card-hover group relative ${
                    isTopPerformer ? 'border-amber-500/30' : 'border-white/5'
                  }`}
                >
                  {/* Rank Badge */}
                  {index < 3 && (
                    <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-amber-500 text-black' :
                      index === 1 ? 'bg-zinc-400 text-black' :
                      'bg-amber-700 text-white'
                    }`}>
                      #{index + 1}
                    </div>
                  )}

                  {/* Bot Header */}
                <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors truncate flex-1">
                        {bot.botId.replace(/^demo_/, '').replace(/_/g, ' ').toUpperCase()}
                  </h3>
                      {bot.metrics && <TopPerformerBadge roiPct={bot.metrics.roiPct} />}
                </div>

                    {/* Market & Timeframe Tags */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-white/5 text-zinc-300 text-xs font-medium rounded border border-white/10">
                        {getMarketDisplayName(market)}
                      </span>
                      <span className="px-2 py-0.5 bg-white/5 text-zinc-300 text-xs font-medium rounded border border-white/10">
                        {getTimeframeDisplayName(timeframe)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-zinc-500 font-mono">
                      by {bot.creator.slice(0, 6)}...{bot.creator.slice(-4)}
                    </p>
                  </div>

                  {/* Metrics */}
                  {bot.metrics ? (
                    <div className="space-y-3 mb-5">
                      {/* ROI - Prominent */}
                      <div className={`rounded-lg p-3 flex items-center justify-between ${
                        isTopPerformer ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-dark-600'
                      }`}>
                        <span className="text-sm text-zinc-400">ROI</span>
                        <span
                          className={`text-xl font-bold ${
                            bot.metrics.roiPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {bot.metrics.roiPct >= 0 ? '+' : ''}{bot.metrics.roiPct.toFixed(2)}%
                      </span>
                      </div>
                      
                      {/* Other metrics grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center bg-dark-600 rounded-lg py-2">
                          <p className="text-xs text-zinc-500 mb-0.5">PnL</p>
                          <p className={`text-sm font-semibold ${
                            bot.metrics.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {bot.metrics.pnlUsd >= 0 ? '+' : ''}${bot.metrics.pnlUsd.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center bg-dark-600 rounded-lg py-2">
                          <p className="text-xs text-zinc-500 mb-0.5">Win Rate</p>
                          <p className="text-sm font-semibold text-white">
                            {bot.metrics.winRate.toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center bg-dark-600 rounded-lg py-2">
                          <p className="text-xs text-zinc-500 mb-0.5">Trades</p>
                          <p className="text-sm font-semibold text-white">
                            {bot.metrics.trades}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center bg-dark-600 rounded-lg mb-5">
                      <p className="text-sm text-zinc-500">No metrics yet</p>
                    </div>
                  )}

                  {/* Footer with actions */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      🍴 {bot.forkCount || 0} forks
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        className="px-3 py-1.5 text-xs font-medium text-zinc-400 bg-white/5 rounded-md hover:bg-white/10 hover:text-white transition-colors border border-white/10"
                        onClick={(e) => {
                          e.preventDefault();
                          alert('Fork functionality coming soon!');
                        }}
                      >
                        Fork Bot
                      </button>
                      <Link
                        href={`/bots/${bot.botId}`}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors"
                      >
                        View Bot →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
