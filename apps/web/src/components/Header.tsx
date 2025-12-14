'use client';

/**
 * Global Header Component
 * 
 * Displays navigation and wallet connect button across all pages.
 * Dark theme styled.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// ============================================================================
// Navigation Links
// ============================================================================

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/create', label: 'Create Bot' },
  { href: '/dashboard', label: 'Dashboard' },
];

// ============================================================================
// Header Component
// ============================================================================

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-dark-800/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <span className="text-xl">🤖</span>
            </div>
            <span className="text-xl font-bold text-white">
              Bot<span className="text-accent">Market</span>
            </span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center space-x-1 bg-dark-700/50 rounded-lg p-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-lg shadow-accent/20'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Connect Button */}
          <div className="flex items-center">
            <ConnectButton 
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-white/5">
        <div className="flex justify-around py-2 bg-dark-800/50">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? 'text-accent bg-accent/10' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default Header;
