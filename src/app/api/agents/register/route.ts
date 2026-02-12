import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { registerAgent, updateAgentErc8004 } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';
import { isErc8004Configured, registerAgentIdentity, setAgentWalletOnChain } from '@/lib/erc8004';
import type { Address } from 'viem';

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiters.registration(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name and description' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Agent name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Description must be between 10 and 500 characters' },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const registration = await registerAgent({ name, description, ip });

    if (isErc8004Configured() && registration.wallet_address && registration.encrypted_private_key) {
      const identityPromise = registerAgentIdentity(registration.agent_id)
        .then(async (tokenId) => {
          await updateAgentErc8004(registration.agent_id, tokenId);
          return tokenId;
        })
        .catch((error) => {
          console.error(`ERC-8004 identity registration failed for ${registration.agent_id}:`, error);
          return null;
        });

      const walletPromise = identityPromise.then((tokenId) => {
        if (tokenId === null) return;
        return setAgentWalletOnChain(
          tokenId,
          registration.wallet_address as Address,
          registration.encrypted_private_key!,
        ).catch((error) => {
          console.error(`ERC-8004 wallet assignment failed for token #${tokenId}:`, error);
        });
      });

      waitUntil(identityPromise);
      waitUntil(walletPromise);
    }

    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully! Save your API key immediately.',
      data: {
        agent_id: registration.agent_id,
        api_key: registration.api_key,
        claim_url: registration.claim_url,
        verification_code: registration.verification_code,
        wallet_address: registration.wallet_address,
      },
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
