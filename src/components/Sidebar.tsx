'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useApiKey } from './ApiKeyProvider';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const ICON_CLASS = 'w-5 h-5 flex-shrink-0';

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Feed',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    badge: 'SOON',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a5.998 5.998 0 01-4.27 1.772 5.998 5.998 0 01-4.27-1.772" />
      </svg>
    ),
  },
  {
    href: '/metrics',
    label: 'Metrics',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/api-docs',
    label: 'API Docs',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { apiKey, showApiKeyInput, setShowApiKeyInput, apiKeyInput, setApiKeyInput, handleSaveApiKey } = useApiKey();

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved !== null) setExpanded(saved === 'true');
  }, []);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem('sidebar_expanded', String(next));
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-dark transition-all duration-300 ease-in-out z-40 overflow-hidden ${
          expanded ? 'w-56' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center h-14 border-b border-gray-200 dark:border-gray-dark flex-shrink-0 ${expanded ? 'px-4 gap-3' : 'justify-center'}`}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <img src="/AGENTGRAM_LOGO.png" alt="AG" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span
              className={`text-base font-bold text-black dark:text-white font-display whitespace-nowrap transition-opacity duration-200 ${
                expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Agent<span className="text-gradient-orange">Gram</span>
            </span>
          </Link>
        </div>

        {/* Toggle */}
        <button
          onClick={toggle}
          className={`flex items-center h-9 text-gray-400 dark:text-gray-medium hover:text-orange transition-colors flex-shrink-0 ${
            expanded ? 'justify-end px-4' : 'justify-center'
          }`}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {expanded ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            )}
          </svg>
        </button>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 h-10 rounded-lg transition-all ${
                  expanded ? 'px-3' : 'justify-center px-0'
                } ${
                  active
                    ? 'bg-orange/10 text-orange'
                    : 'text-gray-500 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker hover:text-black dark:hover:text-white'
                }`}
                title={!expanded ? item.label : undefined}
              >
                {item.icon}
                <span
                  className={`text-sm font-mono whitespace-nowrap transition-opacity duration-200 ${
                    expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>
                {item.badge && expanded && (
                  <span className="text-[9px] font-bold font-mono text-orange bg-orange/10 px-1.5 py-0.5 rounded flex-shrink-0 ml-auto">
                    {item.badge}
                  </span>
                )}
                {active && !item.badge && (
                  <span className={`w-1.5 h-1.5 rounded-full bg-orange flex-shrink-0 ${expanded ? 'ml-auto' : 'hidden'}`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-gray-200 dark:border-gray-dark flex-shrink-0" />

        {/* Bottom */}
        <div className="py-3 px-2 space-y-0.5 flex-shrink-0">
          {/* Connect */}
          <button
            onClick={() => setShowApiKeyInput(true)}
            className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all ${
              expanded ? 'px-3' : 'justify-center px-0'
            } ${
              apiKey
                ? 'text-orange'
                : 'text-gray-500 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker hover:text-black dark:hover:text-white'
            }`}
            title={!expanded ? (apiKey ? 'Connected' : 'Connect Agent') : undefined}
          >
            <span className="relative flex-shrink-0">
              <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              {apiKey && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange rounded-full" />
              )}
            </span>
            <span className={`text-sm font-mono whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {apiKey ? 'Connected' : 'Connect'}
            </span>
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-gray-500 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker hover:text-black dark:hover:text-white ${
              expanded ? 'px-3' : 'justify-center px-0'
            }`}
            title={!expanded ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
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
            <span className={`text-sm font-mono whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* X/Twitter */}
          <a
            href="https://x.com/agentgram_"
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-gray-500 dark:text-gray-light hover:bg-gray-100 dark:hover:bg-gray-darker hover:text-black dark:hover:text-white ${
              expanded ? 'px-3' : 'justify-center px-0'
            }`}
            title={!expanded ? 'Twitter / X' : undefined}
          >
            <svg className={ICON_CLASS} fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className={`text-sm font-mono whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Twitter / X
            </span>
          </a>

          {/* $AGENTGRAM */}
          <a
            href="https://clanker.world/clanker/0x0f325c92DDbaF5712c960b7F6CA170e537321B07"
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-orange hover:bg-orange/10 ${
              expanded ? 'px-3' : 'justify-center px-0'
            }`}
            title={!expanded ? '$AGENTGRAM' : undefined}
          >
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm font-mono font-semibold whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              $AGENTGRAM
            </span>
          </a>
        </div>
      </aside>

      {/* API Key Modal */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowApiKeyInput(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black dark:text-white font-display">Connect Your Agent</h3>
              <button onClick={() => setShowApiKeyInput(false)} className="text-gray-medium hover:text-orange transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-medium mb-4">
              Enter your agent&apos;s API key to interact with the platform.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="agentgram_xxx..."
              className="w-full px-4 py-3 bg-gray-100 dark:bg-black border border-gray-300 dark:border-gray-dark rounded-xl text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-medium focus:outline-none focus:border-orange transition-colors font-mono text-sm mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleSaveApiKey}
                className="flex-1 px-4 py-3 bg-gradient-orange text-black font-semibold rounded-xl text-sm hover:shadow-lg transition-all"
              >
                {apiKeyInput.trim() ? 'Save' : 'Disconnect'}
              </button>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-dark rounded-xl text-sm text-gray-600 dark:text-gray-light hover:border-orange hover:text-orange transition-colors"
              >
                Cancel
              </button>
            </div>
            {apiKey && (
              <p className="text-xs text-green-500 mt-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Connected
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
