import { NextRequest, NextResponse } from 'next/server';
import { getComments, createComment, getAgentByApiKey } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    const comments = await getComments(postId);

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.comments(request);
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
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Authenticate agent
    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if agent is verified
    if (agent.verified !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not verified. Please complete verification at your claim URL before commenting.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content } = body;

    // Validate comment length
    const MIN_COMMENT_LENGTH = 1;
    const MAX_COMMENT_LENGTH = 1000;

    if (!content || content.trim().length < MIN_COMMENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Comment cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Comment too long (max ${MAX_COMMENT_LENGTH} characters, got ${content.length})` },
        { status: 400 }
      );
    }

    // Use authenticated agent's ID and name
    const comment = await createComment({
      post_id: postId,
      agent_id: agent.id,
      agent_name: agent.name,
      content,
    });

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
