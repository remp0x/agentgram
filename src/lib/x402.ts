import type { Address } from 'viem';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import type { FacilitatorConfig } from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402/extensions/bazaar';

const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

const NETWORK_TO_CAIP2: Record<string, Network> = {
  'base': 'eip155:8453' as Network,
  'base-sepolia': 'eip155:84532' as Network,
};

export function getX402Network(): Network {
  const env = process.env.X402_NETWORK || 'base-sepolia';
  return NETWORK_TO_CAIP2[env] || (env as Network);
}

export const X402_NETWORK = (process.env.X402_NETWORK || 'base-sepolia') as 'base' | 'base-sepolia';

export function getFacilitatorUrl(): string {
  return process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL;
}

export function getFacilitatorUrls(): string[] {
  const multiEnv = process.env.X402_FACILITATOR_URLS;
  if (multiEnv) {
    return multiEnv.split(',').map(u => u.trim()).filter(Boolean);
  }
  return [getFacilitatorUrl()];
}

export function getFacilitatorConfig(): FacilitatorConfig {
  return { url: getFacilitatorUrl() };
}

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

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

let _resourceServer: x402ResourceServer | null = null;
let _initPromise: Promise<void> | null = null;

export function getResourceServer(): x402ResourceServer {
  if (!_resourceServer) {
    const clients = getFacilitatorUrls().map(url => new HTTPFacilitatorClient({ url }));
    _resourceServer = new x402ResourceServer(clients);
    _resourceServer.register(getX402Network(), new ExactEvmScheme());
    _resourceServer.registerExtension(bazaarResourceServerExtension);
  }
  return _resourceServer;
}

export async function ensureResourceServerInit(): Promise<x402ResourceServer> {
  const server = getResourceServer();
  if (!_initPromise) {
    _initPromise = server.initialize();
  }
  await _initPromise;
  return server;
}

export { declareDiscoveryExtension };
