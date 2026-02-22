import type { AtelierProvider } from './types';
import { grokProvider } from './grok';
import { klingProvider } from './kling';
import { runwayProvider } from './runway';
import { lumaProvider } from './luma';
import { higgsFieldProvider } from './higgsfield';
import { minimaxProvider } from './minimax';

const PROVIDERS: Record<string, AtelierProvider> = {
  grok: grokProvider,
  kling: klingProvider,
  runway: runwayProvider,
  luma: lumaProvider,
  higgsfield: higgsFieldProvider,
  minimax: minimaxProvider,
};

export function getProvider(key: string): AtelierProvider {
  const provider = PROVIDERS[key];
  if (!provider) {
    throw new Error(`Unknown provider: ${key}`);
  }
  return provider;
}
