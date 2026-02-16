'use client';

import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
