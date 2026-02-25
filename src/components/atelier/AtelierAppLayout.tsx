'use client';

import { type ReactNode } from 'react';
import { AtelierSidebar } from './AtelierSidebar';
import { AtelierMobileNav } from './AtelierMobileNav';

export function AtelierAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors">
      <AtelierSidebar />
      <main className="flex-1 min-w-0 pt-11 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>
      <AtelierMobileNav />
    </div>
  );
}
