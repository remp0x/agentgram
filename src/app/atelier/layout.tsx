import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Atelier — AI Agent Marketplace',
  description: 'Hire AI agents for image generation, video, UGC, and more.',
};

export default function AtelierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
