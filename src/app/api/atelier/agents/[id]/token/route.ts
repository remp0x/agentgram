import { NextRequest, NextResponse } from 'next/server';
import { getAtelierAgent, getAgentTokenInfo, updateAgentToken, ensureAtelierAgent } from '@/lib/atelier-db';
import { getAgent } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

const tokenRateLimit = rateLimit(10, 60 * 60 * 1000);

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const tokenInfo = await getAgentTokenInfo(id);

    if (!tokenInfo) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tokenInfo });
  } catch (error) {
    console.error('Token GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = tokenRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = params;

    let agent = await getAtelierAgent(id);

    if (!agent && !id.startsWith('ext_')) {
      const coreAgent = await getAgent(id);
      if (coreAgent) {
        agent = await ensureAtelierAgent(coreAgent);
      }
    }

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.token_mint) {
      return NextResponse.json(
        { success: false, error: 'Agent already has a token' },
        { status: 409 }
      );
    }

    const body = await request.json();

    const ownerWallet = agent.owner_wallet;
    const isOfficial = agent.is_atelier_official === 1;

    if (isOfficial && !ownerWallet) {
      return NextResponse.json(
        { success: false, error: 'Token launch managed by Atelier' },
        { status: 403 }
      );
    }

    if (ownerWallet && body.token_creator_wallet !== ownerWallet) {
      return NextResponse.json(
        { success: false, error: 'Only the agent owner can launch a token' },
        { status: 403 }
      );
    }
    let { token_mint, token_name, token_symbol, token_image_url, token_mode, token_creator_wallet, token_tx_hash } = body;

    if (!token_mint || !token_name || !token_symbol || !token_mode || !token_creator_wallet) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: token_mint, token_name, token_symbol, token_mode, token_creator_wallet' },
        { status: 400 }
      );
    }

    if (!BASE58_REGEX.test(token_mint)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token_mint: must be a valid base58 Solana address' },
        { status: 400 }
      );
    }

    if (!BASE58_REGEX.test(token_creator_wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token_creator_wallet: must be a valid base58 Solana address' },
        { status: 400 }
      );
    }

    if (token_mode !== 'pumpfun' && token_mode !== 'byot') {
      return NextResponse.json(
        { success: false, error: 'token_mode must be "pumpfun" or "byot"' },
        { status: 400 }
      );
    }

    const SUFFIX = ' by Atelier';
    if (!token_name.endsWith(SUFFIX)) {
      token_name = token_name + SUFFIX;
    }

    const updated = await updateAgentToken(id, {
      token_mint,
      token_name,
      token_symbol,
      token_image_url: token_image_url || undefined,
      token_mode,
      token_creator_wallet,
      token_tx_hash: token_tx_hash || undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Token already set or agent not found' },
        { status: 409 }
      );
    }

    const tokenInfo = await getAgentTokenInfo(id);
    return NextResponse.json({ success: true, data: tokenInfo });
  } catch (error) {
    console.error('Token POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
