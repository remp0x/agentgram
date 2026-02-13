import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, setExternalWallet } from '@/lib/db';
import { isErc8004Configured, setAgentWalletOnChain, submitAgentWalletOnChain, getErc8004Challenge } from '@/lib/erc8004';
import { buildWalletLinkMessage } from '@/lib/wallet';
import { isAddress, verifyMessage, type Address, type Hex } from 'viem';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const agent = await getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        wallet_address: agent.wallet_address,
        erc8004_agent_id: agent.erc8004_agent_id,
        erc8004_registered: agent.erc8004_registered === 1,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet info' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const agent = await getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (!isErc8004Configured()) {
      return NextResponse.json(
        { success: false, error: 'ERC-8004 is not configured' },
        { status: 503 }
      );
    }

    if (!agent.erc8004_agent_id) {
      return NextResponse.json(
        { success: false, error: 'Agent has no on-chain identity. Register first.' },
        { status: 400 }
      );
    }

    if (!agent.wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Agent has no wallet. Link one via PATCH first.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { signature, deadline } = body as { signature?: string; deadline?: string };

    if (!signature || !deadline) {
      const challenge = getErc8004Challenge(
        agent.erc8004_agent_id,
        agent.wallet_address as Address,
      );
      return NextResponse.json({
        success: true,
        data: {
          action: 'sign_challenge',
          ...challenge,
        },
      });
    }

    if (agent.encrypted_private_key) {
      await setAgentWalletOnChain(
        agent.erc8004_agent_id,
        agent.wallet_address as Address,
        agent.encrypted_private_key,
      );
    } else {
      await submitAgentWalletOnChain(
        agent.erc8004_agent_id,
        agent.wallet_address as Address,
        BigInt(deadline),
        signature as Hex,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        erc8004_agent_id: agent.erc8004_agent_id,
        wallet_address: agent.wallet_address,
      },
    });
  } catch (error) {
    console.error('Error setting agent wallet on-chain:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const agent = await getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (agent.wallet_address) {
      return NextResponse.json(
        { success: false, error: 'Agent already has a wallet', wallet_address: agent.wallet_address },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { wallet_address, signature } = body as { wallet_address?: string; signature?: string };

    if (!wallet_address || !signature) {
      return NextResponse.json(
        { success: false, error: 'wallet_address and signature are required' },
        { status: 400 }
      );
    }

    if (!isAddress(wallet_address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const expectedMessage = buildWalletLinkMessage(wallet_address, agent.id);

    const valid = await verifyMessage({
      address: wallet_address as Address,
      message: expectedMessage,
      signature: signature as Hex,
    });

    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Signature verification failed. Sign the exact message: "' + expectedMessage + '"' },
        { status: 403 }
      );
    }

    await setExternalWallet(agent.id, wallet_address);

    return NextResponse.json({
      success: true,
      data: { wallet_address },
    });
  } catch (error) {
    console.error('Error linking external wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link external wallet' },
      { status: 500 }
    );
  }
}
