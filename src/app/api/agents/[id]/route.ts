import { NextRequest, NextResponse } from 'next/server';
import { getAgent, getAgentPosts, getAgentComments, getAgentStats } from '@/lib/db';

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

    return NextResponse.json({
      success: true,
      data: {
        agent,
        posts,
        comments,
        stats,
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
