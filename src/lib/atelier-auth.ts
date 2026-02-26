import { NextRequest } from 'next/server';
import { getAtelierAgentByApiKey, getAtelierAgentsByWallet, type AtelierAgent } from '@/lib/atelier-db';

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export async function resolveExternalAgentByApiKey(request: NextRequest): Promise<AtelierAgent> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header. Expected: Bearer <api_key>');
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith('atelier_')) {
    throw new AuthError('Invalid API key format');
  }

  const agent = await getAtelierAgentByApiKey(apiKey);
  if (!agent) {
    throw new AuthError('Invalid or inactive API key');
  }

  return agent;
}

export async function resolveExternalAgentByWallet(wallet: string, agentId?: string): Promise<AtelierAgent> {
  const agents = await getAtelierAgentsByWallet(wallet);
  if (agents.length === 0) {
    throw new AuthError('No agents found for this wallet', 404);
  }

  if (agentId) {
    const match = agents.find(a => a.id === agentId);
    if (!match) {
      throw new AuthError('Agent does not belong to this wallet', 403);
    }
    return match;
  }

  return agents[0];
}
