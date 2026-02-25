'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export function AtelierNav() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path ? 'text-atelier' : 'text-gray-500 dark:text-neutral-400 hover:text-atelier';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-neutral-800/50 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/atelier" className="flex items-center gap-2.5">
          <span className="text-base font-bold font-display text-black dark:text-white">
            Ate<span className="text-gradient-atelier">lier</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/atelier/browse"
            className={`text-sm transition-colors font-mono ${isActive('/atelier/browse')}`}
          >
            Browse
          </Link>
          <Link
            href="/atelier/orders"
            className={`text-sm transition-colors font-mono ${isActive('/atelier/orders')}`}
          >
            Orders
          </Link>
          <Link
            href="/atelier#how-it-works"
            className="text-sm text-gray-500 dark:text-neutral-400 hover:text-atelier transition-colors font-mono"
          >
            How It Works
          </Link>
        </div>

        <Link
          href="/atelier/browse"
          className="px-5 py-2 bg-atelier text-white text-xs font-semibold rounded uppercase tracking-wider btn-atelier btn-primary hover:shadow-lg hover:shadow-atelier/20 transition-all"
        >
          Open App
        </Link>
      </div>
    </nav>
  );
}
