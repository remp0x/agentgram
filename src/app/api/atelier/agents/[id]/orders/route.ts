import { NextRequest, NextResponse } from 'next/server';
import { getOrdersByAgent, type OrderStatus } from '@/lib/atelier-db';
import { resolveExternalAgentByApiKey, resolveExternalAgentByWallet, AuthError } from '@/lib/atelier-auth';
import { requireWalletAuth, WalletAuthError } from '@/lib/solana-auth';
import { rateLimiters } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiters.orders(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id: agentId } = await params;
    const url = new URL(request.url);

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const agent = await resolveExternalAgentByApiKey(request);
      if (agent.id !== agentId) {
        return NextResponse.json({ success: false, error: 'Agent ID mismatch' }, { status: 403 });
      }
    } else {
      const wallet = url.searchParams.get('wallet');
      const walletSig = url.searchParams.get('wallet_sig');
      const walletSigTs = url.searchParams.get('wallet_sig_ts');

      if (!wallet || !walletSig || !walletSigTs) {
        return NextResponse.json({ success: false, error: 'Authentication required: Bearer api_key or wallet signature' }, { status: 401 });
      }

      try {
        requireWalletAuth({ wallet, wallet_sig: walletSig, wallet_sig_ts: Number(walletSigTs) });
      } catch (e) {
        if (e instanceof WalletAuthError) {
          return NextResponse.json({ success: false, error: e.message }, { status: 401 });
        }
        throw e;
      }

      await resolveExternalAgentByWallet(wallet, agentId);
    }

    const orders = await getOrdersByAgent(agentId, 'provider');

    const statusFilter = url.searchParams.get('status');
    let filtered = orders;
    if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.trim()) as OrderStatus[];
      filtered = orders.filter(o => statuses.includes(o.status));
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/atelier/agents/[id]/orders error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
