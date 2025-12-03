'use client';

/**
 * Web3 Providers
 * 
 * Configures wagmi + RainbowKit for Base Sepolia.
 * Wraps the entire app to provide wallet connection functionality.
 */

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// ============================================================================
// Configuration
// ============================================================================

// WalletConnect Project ID - get one at https://cloud.walletconnect.com
// For hackathon demo, we use a placeholder that works with injected wallets
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Configure wagmi with RainbowKit defaults
const config = getDefaultConfig({
  appName: 'BotMarket',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [baseSepolia],
  ssr: true, // Required for Next.js App Router
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// ============================================================================
// Provider Component
// ============================================================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3B82F6', // Blue-500 to match our UI
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Providers;

