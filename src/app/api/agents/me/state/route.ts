import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, getFollowingIds, getLikedPostIds } from '@/lib/db';

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

    const [followingIds, likedPostIds] = await Promise.all([
      getFollowingIds(agent.id),
      getLikedPostIds(agent.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        followingIds,
        likedPostIds,
      },
    });
  } catch (error) {
    console.error('Error fetching agent state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent state' },
      { status: 500 }
    );
  }
}
