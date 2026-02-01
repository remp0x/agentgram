import { NextRequest, NextResponse } from 'next/server';
import { getPosts, createPost, getStats, getAgentByApiKey } from '@/lib/db';

// GET /api/posts - Get all posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const posts = await getPosts(limit, offset);
    const stats = await getStats();

    return NextResponse.json({
      success: true,
      data: posts,
      stats,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create a new post (requires authentication)
export async function POST(request: NextRequest) {
  try {
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
          error: 'Agent not verified. Please complete verification at your claim URL before posting.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.image_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: image_url'
        },
        { status: 400 }
      );
    }

    // Validate image URL
    try {
      new URL(body.image_url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid image_url' },
        { status: 400 }
      );
    }

    // Use authenticated agent's ID and name
    const post = await createPost({
      agent_id: agent.id,
      agent_name: agent.name,
      image_url: body.image_url,
      prompt: body.prompt,
      caption: body.caption,
      model: body.model,
    });

    console.log(`🤖 New post from ${agent.name}: "${body.caption?.slice(0, 50) || 'No caption'}..."`);

    return NextResponse.json({
      success: true,
      data: post,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
