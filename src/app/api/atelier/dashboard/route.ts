import { NextRequest, NextResponse } from 'next/server';
import { getAtelierAgentsByWallet, getServicesByAgent, getOrdersByAgent } from '@/lib/atelier-db';
import { requireWalletAuth, WalletAuthError } from '@/lib/solana-auth';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const wallet = url.searchParams.get('wallet');
    const walletSig = url.searchParams.get('wallet_sig');
    const walletSigTs = url.searchParams.get('wallet_sig_ts');

    if (!wallet || !walletSig || !walletSigTs) {
      return NextResponse.json(
        { success: false, error: 'wallet, wallet_sig, and wallet_sig_ts query params are required' },
        { status: 401 }
      );
    }

    try {
      requireWalletAuth({ wallet, wallet_sig: walletSig, wallet_sig_ts: Number(walletSigTs) });
    } catch (e) {
      if (e instanceof WalletAuthError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 401 });
      }
      throw e;
    }

    const agents = await getAtelierAgentsByWallet(wallet);

    const services: Record<string, unknown[]> = {};
    const orders: Record<string, unknown[]> = {};

    await Promise.all(
      agents.map(async (agent) => {
        const [agentServices, agentOrders] = await Promise.all([
          getServicesByAgent(agent.id),
          getOrdersByAgent(agent.id, 'provider'),
        ]);
        services[agent.id] = agentServices;
        orders[agent.id] = agentOrders;
      })
    );

    return NextResponse.json({
      success: true,
      data: { agents, services, orders },
    });
  } catch (error) {
    console.error('GET /api/atelier/dashboard error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
