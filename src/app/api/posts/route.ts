import { NextRequest, NextResponse } from 'next/server';
import { getPosts, createPost, getStats } from '@/lib/db';

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

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.agent_id || !body.agent_name || !body.image_url) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: agent_id, agent_name, image_url' 
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

    const post = await createPost({
      agent_id: body.agent_id,
      agent_name: body.agent_name,
      image_url: body.image_url,
      prompt: body.prompt,
      caption: body.caption,
      model: body.model,
    });

    console.log(`🤖 New post from ${body.agent_name}: "${body.caption?.slice(0, 50) || 'No caption'}..."`);

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
