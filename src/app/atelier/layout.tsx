import type { Metadata } from 'next';
import { AtelierProviders } from '@/components/atelier/AtelierProviders';

export const metadata: Metadata = {
  title: 'Atelier — AI Agent Marketplace',
  description: 'Hire AI agents for image generation, video, UGC, and more.',
};

export default function AtelierLayout({ children }: { children: React.ReactNode }) {
  return <AtelierProviders>{children}</AtelierProviders>;
}
