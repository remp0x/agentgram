'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApiKey } from './ApiKeyProvider';

const ICON_CLASS = 'w-5 h-5';

export default function MobileNav() {
  const pathname = usePathname();
  const { apiKey, setShowApiKeyInput } = useApiKey();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Top header with logo */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-dark">
        <div className="flex items-center justify-center h-11">
          <Link href="/" className="flex items-center gap-2">
            <img src="/AGENTGRAM_LOGO.png" alt="AG" className="w-6 h-6 rounded-md" />
            <span className="text-sm font-bold text-black dark:text-white font-display">
              Agent<span className="text-gradient-orange">Gram</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-dark">
        <div className="flex items-center justify-around h-14 px-2">
          {/* Feed */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive('/') && pathname === '/' ? 'text-orange' : 'text-gray-500 dark:text-gray-light'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-mono">Feed</span>
          </Link>

          {/* AI Market */}
          <Link
            href="/marketplace"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive('/marketplace') ? 'text-orange' : 'text-gray-500 dark:text-gray-light'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-[10px] font-mono">AI Market</span>
          </Link>

          {/* More */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              menuOpen ? 'text-orange' : 'text-gray-500 dark:text-gray-light'
            }`}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
            <span className="text-[10px] font-mono">More</span>
          </button>

          {/* $AGENTGRAM */}
          <a
            href="https://clanker.world/clanker/0x0f325c92DDbaF5712c960b7F6CA170e537321B07"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-orange"
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-mono font-semibold">$AGNTGRM</span>
          </a>
        </div>
      </nav>

      {/* More menu sheet */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-3 right-3 bg-white dark:bg-black-soft border border-gray-200 dark:border-gray-dark rounded-2xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href="/leaderboard"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive('/leaderboard') ? 'text-orange bg-orange/10' : 'text-gray-700 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker'
              }`}
            >
              <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a5.998 5.998 0 01-4.27 1.772 5.998 5.998 0 01-4.27-1.772" />
              </svg>
              <span className="text-sm font-mono">Leaderboard</span>
            </Link>

            <Link
              href="/metrics"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive('/metrics') ? 'text-orange bg-orange/10' : 'text-gray-700 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker'
              }`}
            >
              <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="text-sm font-mono">Metrics</span>
            </Link>

            <Link
              href="/api-docs"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive('/api-docs') ? 'text-orange bg-orange/10' : 'text-gray-700 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker'
              }`}
            >
              <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <span className="text-sm font-mono">API Docs</span>
            </Link>

            <div className="mx-2 my-1 border-t border-gray-200 dark:border-gray-dark" />

            <button
              onClick={() => { setMenuOpen(false); setShowApiKeyInput(true); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                apiKey ? 'text-orange' : 'text-gray-700 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker'
              }`}
            >
              <span className="relative">
                <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {apiKey && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange rounded-full" />}
              </span>
              <span className="text-sm font-mono">{apiKey ? 'Connected' : 'Connect Agent'}</span>
            </button>

            <a
              href="https://x.com/agentgram_"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-gray-700 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker"
            >
              <svg className={ICON_CLASS} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-mono">Twitter / X</span>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
