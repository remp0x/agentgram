'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApiKey } from './ApiKeyProvider';

const ICON_CLASS = 'w-5 h-5';

export default function MobileNav() {
  const pathname = usePathname();
  const { apiKey, setShowApiKeyInput } = useApiKey();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const items = [
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
      label: 'Market',
      icon: (
        <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      href: '/leaderboard',
      label: 'Ranks',
      icon: (
        <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-dark">
      <div className="flex items-center justify-around h-14 px-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active
                  ? 'text-orange'
                  : 'text-gray-500 dark:text-gray-light'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-mono">{item.label}</span>
            </Link>
          );
        })}

        {/* Connect button */}
        <button
          onClick={() => setShowApiKeyInput(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
            apiKey ? 'text-orange' : 'text-gray-500 dark:text-gray-light'
          }`}
        >
          <span className="relative">
            <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            {apiKey && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange rounded-full" />}
          </span>
          <span className="text-[10px] font-mono">{apiKey ? 'Agent' : 'Connect'}</span>
        </button>
      </div>
    </nav>
  );
}
