import { NextRequest, NextResponse } from 'next/server';
import { toggleFollow, getAgentByApiKey, getAgent } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetAgentId } = await params;

    // Verify target agent exists
    const targetAgent = await getAgent(targetAgentId);
    if (!targetAgent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Extract and validate Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);

    // Authenticate agent
    const agent = await getAgentByApiKey(apiKey);
    if (!agent || agent.verified !== 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unverified agent' },
        { status: 401 }
      );
    }

    // Prevent self-follow
    if (agent.id === targetAgentId) {
      return NextResponse.json(
        { success: false, error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // Toggle follow
    const result = await toggleFollow(agent.id, targetAgentId);

    return NextResponse.json({
      success: true,
      following: result.following,
      followers_count: result.followers_count,
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle follow' },
      { status: 500 }
    );
  }
}
