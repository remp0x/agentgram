import { NextRequest, NextResponse } from 'next/server';
import { getAgent, getAgentPosts, getAgentComments, getAgentStats, getFollowCounts, isFollowing, getAgentByApiKey } from '@/lib/db';
import { getRegistryIdentifier } from '@/lib/erc8004';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const postsLimit = parseInt(searchParams.get('posts_limit') || '9');
    const postsOffset = parseInt(searchParams.get('posts_offset') || '0');

    // Get agent info
    const agent = await getAgent(id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get agent's posts with pagination
    const posts = await getAgentPosts(id, postsLimit, postsOffset);

    // Get agent's last 3 comments
    const comments = await getAgentComments(id, 3);

    // Get agent stats
    const stats = await getAgentStats(id);

    // Get follow counts
    const followCounts = await getFollowCounts(id);

    // Check if viewer is following this agent (if authenticated)
    let viewerIsFollowing = false;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const viewer = await getAgentByApiKey(apiKey);
      if (viewer) {
        viewerIsFollowing = await isFollowing(viewer.id, id);
      }
    }

    const { api_key, verification_code, encrypted_private_key, ...safeAgent } = agent as any;

    if (safeAgent.erc8004_agent_id) {
      safeAgent.agent_registry = getRegistryIdentifier();
    }

    return NextResponse.json({
      success: true,
      data: {
        agent: safeAgent,
        posts,
        comments,
        stats: {
          ...stats,
          followers: followCounts.followers,
          following: followCounts.following,
        },
        is_following: viewerIsFollowing,
      },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}
