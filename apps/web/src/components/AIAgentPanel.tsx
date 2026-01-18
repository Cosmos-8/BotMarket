'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';

interface AIConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  systemPrompt?: string;
}

interface TwitterConfig {
  enabled: boolean;
  keywords: string[];
  accounts: string[];
  scanIntervalMinutes: number;
}

interface TradingConfig {
  maxPositionSize: number;
  maxDailyTrades: number;
  cooldownMinutes: number;
  requireConfidence: number;
}

interface AIAgentPanelProps {
  botId: string;
  initialConfig?: {
    ai?: Partial<AIConfig>;
    twitter?: Partial<TwitterConfig>;
    trading?: Partial<TradingConfig>;
  };
  onConfigUpdate?: () => void;
}

export function AIAgentPanel({ botId, initialConfig, onConfigUpdate }: AIAgentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI config state
  const [aiEnabled, setAiEnabled] = useState(initialConfig?.ai?.enabled || false);
  const [model, setModel] = useState(initialConfig?.ai?.model || 'llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(initialConfig?.ai?.temperature || 0.7);
  const [systemPrompt, setSystemPrompt] = useState(initialConfig?.ai?.systemPrompt || '');

  // Twitter config state
  const [twitterEnabled, setTwitterEnabled] = useState(initialConfig?.twitter?.enabled ?? true);
  const [keywords, setKeywords] = useState(initialConfig?.twitter?.keywords?.join(', ') || '');
  const [accounts, setAccounts] = useState(initialConfig?.twitter?.accounts?.join(', ') || '');
  const [scanInterval, setScanInterval] = useState(initialConfig?.twitter?.scanIntervalMinutes || 5);

  // Trading config state
  const [maxPositionSize, setMaxPositionSize] = useState(initialConfig?.trading?.maxPositionSize || 10);
  const [maxDailyTrades, setMaxDailyTrades] = useState(initialConfig?.trading?.maxDailyTrades || 5);
  const [cooldownMinutes, setCooldownMinutes] = useState(initialConfig?.trading?.cooldownMinutes || 30);
  const [requireConfidence, setRequireConfidence] = useState(initialConfig?.trading?.requireConfidence || 0.7);

  const handleSaveConfig = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const aiConfig = {
        enabled: aiEnabled,
        model,
        temperature,
        systemPrompt: systemPrompt || undefined,
        twitter: {
          enabled: twitterEnabled,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          accounts: accounts.split(',').map(a => a.trim().replace('@', '')).filter(Boolean),
          scanIntervalMinutes: scanInterval,
        },
        trading: {
          maxPositionSize,
          maxDailyTrades,
          cooldownMinutes,
          requireConfidence,
        },
      };

      await api.post(`/agent/${botId}/configure`, { aiConfig });
      setMessage({ type: 'success', text: 'AI agent configuration saved!' });
      onConfigUpdate?.();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
    } finally {
      setIsSaving(false);
    }
  }, [
    botId, aiEnabled, model, temperature, systemPrompt,
    twitterEnabled, keywords, accounts, scanInterval,
    maxPositionSize, maxDailyTrades, cooldownMinutes, requireConfidence,
    onConfigUpdate
  ]);

  const handleStartAgent = useCallback(async () => {
    setIsStarting(true);
    setMessage(null);

    try {
      await api.post(`/agent/${botId}/start`);
      setMessage({ type: 'success', text: 'AI agent started! It will begin scanning for opportunities.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to start agent' });
    } finally {
      setIsStarting(false);
    }
  }, [botId]);

  const handleStopAgent = useCallback(async () => {
    setIsStopping(true);
    setMessage(null);

    try {
      await api.post(`/agent/${botId}/stop`);
      setMessage({ type: 'success', text: 'AI agent stopped.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to stop agent' });
    } finally {
      setIsStopping(false);
    }
  }, [botId]);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🤖</div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">AI Trading Agent</h3>
            <p className="text-sm text-zinc-400">
              {aiEnabled ? 'Enabled - Autonomous trading mode' : 'Disabled - Configure to enable AI decisions'}
            </p>
          </div>
        </div>
        <div className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between bg-black/20 rounded-lg p-4">
            <div>
              <div className="text-white font-medium">Enable AI Agent</div>
              <div className="text-sm text-zinc-400">Let AI make autonomous trading decisions</div>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-14 h-8 rounded-full transition-colors ${
                aiEnabled ? 'bg-purple-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full transition-transform ${
                  aiEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {aiEnabled && (
            <>
              {/* AI Model Settings */}
              <div className="bg-black/20 rounded-lg p-4 space-y-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <span>🧠</span> AI Model
                </h4>
                
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  >
                    <optgroup label="🆓 Groq (FREE)">
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (Faster)</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                    </optgroup>
                    <optgroup label="💰 OpenAI (Paid)">
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">Groq models are FREE with generous limits!</p>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Temperature: {temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Conservative</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Custom System Prompt (Optional)
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Add specific instructions for how the AI should analyze and trade..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white h-24 resize-none"
                  />
                </div>
              </div>

              {/* Twitter Settings */}
              <div className="bg-black/20 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span>🐦</span> Twitter Scanning
                  </h4>
                  <button
                    onClick={() => setTwitterEnabled(!twitterEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      twitterEnabled ? 'bg-blue-500' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        twitterEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {twitterEnabled && (
                  <>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="breaking news, announcement, pump"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        Twitter Accounts to Follow (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={accounts}
                        onChange={(e) => setAccounts(e.target.value)}
                        placeholder="@elonmusk, @VitalikButerin, @CoinDesk"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        Scan Interval: {scanInterval} minutes
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={scanInterval}
                        onChange={(e) => setScanInterval(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Trading Settings */}
              <div className="bg-black/20 rounded-lg p-4 space-y-4">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <span>📊</span> Trading Rules
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Max Position Size ($)
                    </label>
                    <input
                      type="number"
                      value={maxPositionSize}
                      onChange={(e) => setMaxPositionSize(parseFloat(e.target.value))}
                      min="1"
                      max="1000"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Max Daily Trades
                    </label>
                    <input
                      type="number"
                      value={maxDailyTrades}
                      onChange={(e) => setMaxDailyTrades(parseInt(e.target.value))}
                      min="1"
                      max="50"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Cooldown (minutes)
                    </label>
                    <input
                      type="number"
                      value={cooldownMinutes}
                      onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
                      min="1"
                      max="1440"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Min Confidence: {Math.round(requireConfidence * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={requireConfidence}
                      onChange={(e) => setRequireConfidence(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                  onClick={handleStartAgent}
                  disabled={isStarting || isStopping}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isStarting ? 'Starting...' : '▶ Start'}
                </button>

                <button
                  onClick={handleStopAgent}
                  disabled={isStarting || isStopping}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isStopping ? 'Stopping...' : '⏹ Stop'}
                </button>
              </div>
            </>
          )}

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Info */}
          {!aiEnabled && (
            <div className="text-sm text-zinc-400 bg-black/20 rounded-lg p-3">
              <p className="font-medium text-zinc-300 mb-1">How AI Agent Works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Scans Twitter for market-moving news and sentiment</li>
                <li>Analyzes Polymarket odds and volume</li>
                <li>Uses GPT-4 to make trading decisions</li>
                <li>Automatically executes trades when confident</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
