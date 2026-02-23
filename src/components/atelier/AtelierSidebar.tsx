'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../ThemeProvider';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const ICON_CLASS = 'w-5 h-5 flex-shrink-0';

const navItems: NavItem[] = [
  {
    href: '/atelier/browse',
    label: 'Browse',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/atelier/services',
    label: 'Services',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    href: '/atelier/orders',
    label: 'My Orders',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: '/atelier/profile',
    label: 'Profile',
    icon: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export function AtelierSidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem('atelier_sidebar_expanded');
    if (saved !== null) setExpanded(saved === 'true');
  }, []);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem('atelier_sidebar_expanded', String(next));
  };

  const isActive = (href: string) => {
    if (href === '/atelier/browse') return pathname === '/atelier/browse';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 bg-white dark:bg-black border-r border-gray-200 dark:border-neutral-800 transition-all duration-300 ease-in-out z-40 overflow-hidden ${
        expanded ? 'w-56' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-14 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0 ${expanded ? 'px-4 gap-3' : 'justify-center'}`}>
        <Link href="/atelier" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-atelier flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold font-display">A</span>
          </div>
          <span
            className={`text-base font-bold text-black dark:text-white font-display whitespace-nowrap transition-opacity duration-200 ${
              expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}
          >
            Ate<span className="text-gradient-atelier">lier</span>
          </span>
        </Link>
      </div>

      {/* Toggle */}
      <button
        onClick={toggle}
        className={`flex items-center h-9 text-gray-400 dark:text-neutral-500 hover:text-atelier transition-colors flex-shrink-0 ${
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
                  ? 'bg-atelier/10 text-atelier'
                  : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-black dark:hover:text-white'
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
                <span className="text-[9px] font-bold font-mono text-atelier bg-atelier/10 px-1.5 py-0.5 rounded flex-shrink-0 ml-auto">
                  {item.badge}
                </span>
              )}
              {active && !item.badge && (
                <span className={`w-1.5 h-1.5 rounded-full bg-atelier flex-shrink-0 ${expanded ? 'ml-auto' : 'hidden'}`} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-gray-200 dark:border-neutral-800 flex-shrink-0" />

      {/* Bottom */}
      <div className="py-3 px-2 space-y-0.5 flex-shrink-0">
        {/* Theme */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-black dark:hover:text-white ${
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
          className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-black dark:hover:text-white ${
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

        {/* $ATELIER */}
        <a
          href="/atelier#token"
          className={`w-full flex items-center gap-3 h-10 rounded-lg transition-all text-atelier hover:bg-atelier/10 ${
            expanded ? 'px-3' : 'justify-center px-0'
          }`}
          title={!expanded ? '$ATELIER' : undefined}
        >
          <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-sm font-mono font-semibold whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            $ATELIER
          </span>
        </a>

        {/* Wallet */}
        <div className={`${expanded ? '' : 'flex justify-center'}`}>
          <WalletMultiButton
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
              color: 'white',
              fontSize: expanded ? '0.75rem' : '0',
              fontWeight: 600,
              borderRadius: '0.5rem',
              height: '2.25rem',
              width: expanded ? '100%' : '2.25rem',
              padding: expanded ? '0 0.75rem' : '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
            }}
          />
        </div>
      </div>
    </aside>
  );
}
