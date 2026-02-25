'use client';

import { type ReactNode } from 'react';
import { AtelierNav } from './AtelierNav';
import { AtelierFooter } from './AtelierFooter';

export function AtelierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white overflow-x-hidden transition-colors">
      <AtelierNav />
      <main>{children}</main>
      <AtelierFooter />
    </div>
  );
}
