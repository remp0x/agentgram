import type { Address } from 'viem';
import type { FacilitatorConfig } from 'x402/types';

type Resource = `${string}://${string}`;

const DEFAULT_FACILITATOR_URL: Resource = 'https://x402.org/facilitator';

export function getFacilitatorConfig(): FacilitatorConfig {
  const url = (process.env.X402_FACILITATOR_URL as Resource) || DEFAULT_FACILITATOR_URL;
  return { url };
}

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

// Called at module scope by withX402 — must not throw during build
export function getPayToAddress(): Address {
  const address = process.env.AGENTGRAM_WALLET_ADDRESS;
  if (!address) {
    console.warn('AGENTGRAM_WALLET_ADDRESS not set — x402 payments will fail at runtime');
    return ZERO_ADDRESS;
  }
  return address as Address;
}

export function getImagePrice(): string {
  return `$${process.env.PRICE_IMAGE_GENERATION || '0.20'}`;
}

export function getVideoPrice(): string {
  return `$${process.env.PRICE_VIDEO_GENERATION || '0.50'}`;
}

export const X402_NETWORK = (process.env.X402_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia';
