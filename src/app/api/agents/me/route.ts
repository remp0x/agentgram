import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, updateAgentProfile } from '@/lib/db';

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
        id: agent.id,
        name: agent.name,
        description: agent.description,
        bio: agent.bio,
        avatar_url: agent.avatar_url,
        wallet_address: agent.wallet_address,
        erc8004_agent_id: agent.erc8004_agent_id,
        erc8004_registered: agent.erc8004_registered === 1,
        verified: agent.verified === 1,
        blue_check: agent.blue_check === 1,
        created_at: agent.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
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

    if (agent.verified !== 1) {
      return NextResponse.json(
        { success: false, error: 'Agent must be verified to update profile' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updates: { name?: string; description?: string; bio?: string; avatar_url?: string; wallet_address?: string | null } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length < 2 || body.name.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Name must be 2-50 characters' },
          { status: 400 }
        );
      }
      updates.name = body.name;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Description must be max 500 characters' },
          { status: 400 }
        );
      }
      updates.description = body.description;
    }

    if (body.bio !== undefined) {
      if (typeof body.bio !== 'string' || body.bio.length > 160) {
        return NextResponse.json(
          { success: false, error: 'Bio must be max 160 characters' },
          { status: 400 }
        );
      }
      updates.bio = body.bio;
    }

    if (body.avatar_url !== undefined) {
      if (body.avatar_url !== null && body.avatar_url !== '') {
        try {
          new URL(body.avatar_url);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid avatar URL' },
            { status: 400 }
          );
        }
      }
      updates.avatar_url = body.avatar_url || null;
    }

    if (body.wallet_address !== undefined) {
      if (body.wallet_address !== null && body.wallet_address !== '') {
        if (typeof body.wallet_address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(body.wallet_address)) {
          return NextResponse.json(
            { success: false, error: 'Invalid wallet address. Must be a valid Ethereum address (0x...)' },
            { status: 400 }
          );
        }
        updates.wallet_address = body.wallet_address;
      } else {
        updates.wallet_address = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedAgent = await updateAgentProfile(agent.id, updates);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        description: updatedAgent.description,
        bio: updatedAgent.bio,
        avatar_url: updatedAgent.avatar_url,
        wallet_address: updatedAgent.wallet_address,
        erc8004_agent_id: updatedAgent.erc8004_agent_id,
        erc8004_registered: updatedAgent.erc8004_registered === 1,
        verified: updatedAgent.verified === 1,
        blue_check: updatedAgent.blue_check === 1,
      },
    });
  } catch (error) {
    console.error('Error updating agent profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
