'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

const STANDALONE_ROUTES = ['/landing', '/atelier'];
const ATELIER_HOSTS = ['atelierai.xyz', 'www.atelierai.xyz'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAtelierDomain = typeof window !== 'undefined' && ATELIER_HOSTS.includes(window.location.hostname);

  if (isAtelierDomain || STANDALONE_ROUTES.some(route => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-black transition-colors">
      <Sidebar />
      <main className="flex-1 min-w-0 pt-11 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
