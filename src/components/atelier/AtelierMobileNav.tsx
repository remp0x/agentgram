'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../ThemeProvider';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

const ICON_CLASS = 'w-5 h-5';

export function AtelierMobileNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/atelier/browse') return pathname === '/atelier/browse';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Top header with logo */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800">
        <div className="flex items-center justify-center h-11">
          <Link href="/atelier" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-atelier flex items-center justify-center">
              <span className="text-white text-xs font-bold font-display">A</span>
            </div>
            <span className="text-sm font-bold text-black dark:text-white font-display">
              Ate<span className="text-gradient-atelier">lier</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-200 dark:border-neutral-800">
        <div className="flex items-center justify-around h-14 px-2">
          {/* Browse */}
          <Link
            href="/atelier/browse"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive('/atelier/browse') ? 'text-atelier' : 'text-gray-500 dark:text-neutral-400'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="text-[10px] font-mono">Browse</span>
          </Link>

          {/* Services */}
          <Link
            href="/atelier/services"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive('/atelier/services') ? 'text-atelier' : 'text-gray-500 dark:text-neutral-400'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span className="text-[10px] font-mono">Services</span>
          </Link>

          {/* More */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              menuOpen ? 'text-atelier' : 'text-gray-500 dark:text-neutral-400'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
            <span className="text-[10px] font-mono">More</span>
          </button>

          {/* $ATELIER */}
          <a
            href="/atelier#token"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-atelier"
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-mono font-semibold">$ATELIER</span>
          </a>
        </div>
      </nav>

      {/* More menu sheet */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-3 right-3 bg-white dark:bg-black-soft border border-gray-200 dark:border-neutral-800 rounded-xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href="/atelier/orders"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
            >
              <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-sm font-mono">My Orders</span>
              <span className="text-[9px] font-bold font-mono text-atelier bg-atelier/10 px-1.5 py-0.5 rounded ml-auto">
                SOON
              </span>
            </Link>

            <div className="mx-2 my-1 border-t border-gray-200 dark:border-neutral-800" />

            <button
              onClick={() => { setMenuOpen(false); toggleTheme(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
            >
              {theme === 'dark' ? (
                <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              <span className="text-sm font-mono">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <a
              href="https://x.com/agentgram_"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
            >
              <svg className={ICON_CLASS} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-mono">Twitter / X</span>
            </a>

            <div className="mx-2 my-1 border-t border-gray-200 dark:border-neutral-800" />

            <div className="px-4 py-3">
              <WalletMultiButton
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  height: '2.5rem',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
