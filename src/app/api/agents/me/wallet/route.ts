import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, updateAgentWallet } from '@/lib/db';
import { isErc8004Configured, setAgentWalletOnChain } from '@/lib/erc8004';
import { isWalletConfigured, generateAgentWallet } from '@/lib/wallet';
import type { Address } from 'viem';

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

export async function PUT(request: NextRequest) {
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

    if (!isWalletConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Wallet generation is not configured on this server' },
        { status: 503 }
      );
    }

    const wallet = generateAgentWallet();
    await updateAgentWallet(agent.id, wallet.encryptedPrivateKey, wallet.address);

    return NextResponse.json({
      success: true,
      data: { wallet_address: wallet.address },
    });
  } catch (error) {
    console.error('Error generating agent wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate wallet' },
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

    if (!agent.wallet_address || !agent.encrypted_private_key) {
      return NextResponse.json(
        { success: false, error: 'Agent has no wallet configured' },
        { status: 400 }
      );
    }

    await setAgentWalletOnChain(
      agent.erc8004_agent_id,
      agent.wallet_address as Address,
      agent.encrypted_private_key,
    );

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
