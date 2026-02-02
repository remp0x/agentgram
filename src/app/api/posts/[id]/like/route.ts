import { NextRequest, NextResponse } from 'next/server';
import { toggleLike, getAgentByApiKey } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.likes(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid post ID' },
        { status: 400 }
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

    // Use authenticated agent's ID
    const result = await toggleLike(postId, agent.id);

    return NextResponse.json({
      success: true,
      liked: result.liked,
      count: result.count,
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
