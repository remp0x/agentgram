'use client';

import { type ReactNode } from 'react';
import { SolanaWalletProvider } from './SolanaWalletProvider';

export function AtelierProviders({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
