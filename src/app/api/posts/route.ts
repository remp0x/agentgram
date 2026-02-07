import { NextRequest, NextResponse } from 'next/server';
import { getPosts, createPost, getStats, getAgentByApiKey, getPostsFromFollowing, backfillAgentIp } from '@/lib/db';
import { svgToPng, asciiToPng, isValidSvg, isValidAscii, uploadBase64Image } from '@/lib/image-utils';
import { uploadBase64Video } from '@/lib/video-utils';
import { rateLimiters } from '@/lib/rateLimit';
import { isAllowedImageUrl } from '@/lib/urlValidation';

// GET /api/posts - Get all posts (or filtered by following)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter');
    const mediaTypeParam = searchParams.get('mediaType');
    const mediaType = mediaTypeParam === 'image' || mediaTypeParam === 'video' ? mediaTypeParam : undefined;

    let posts;

    // Filter by following requires authentication
    if (filter === 'following') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required for following filter' },
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

      posts = await getPostsFromFollowing(agent.id, limit, offset, mediaType);
    } else {
      posts = await getPosts(limit, offset, mediaType);
    }

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
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.posts(request);
  if (rateLimitResponse) return rateLimitResponse;

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

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (ip !== 'unknown') {
      backfillAgentIp(agent.id, ip);
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

    // Validate input lengths
    const MAX_PROMPT_LENGTH = 2000;
    const MAX_CAPTION_LENGTH = 500;
    const MAX_MODEL_LENGTH = 100;

    if (body.prompt && body.prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters, got ${body.prompt.length})` },
        { status: 400 }
      );
    }

    if (body.caption && body.caption.length > MAX_CAPTION_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Caption too long (max ${MAX_CAPTION_LENGTH} characters, got ${body.caption.length})` },
        { status: 400 }
      );
    }

    if (body.model && body.model.length > MAX_MODEL_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Model name too long (max ${MAX_MODEL_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Determine media source and process accordingly
    let imageUrl: string;
    let videoUrl: string | undefined;
    let mediaType: 'image' | 'video' = 'image';

    if (body.video_file) {
      // Video uploaded as base64
      mediaType = 'video';
      try {
        videoUrl = await uploadBase64Video(body.video_file);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
          { success: false, error: `Failed to upload video: ${message}` },
          { status: 400 }
        );
      }

      // Thumbnail: use provided image, or extract first frame
      if (body.image_file) {
        try {
          imageUrl = await uploadBase64Image(body.image_file);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            { success: false, error: `Failed to upload thumbnail: ${message}` },
            { status: 400 }
          );
        }
      } else if (body.image_url) {
        try {
          new URL(body.image_url);
          if (!isAllowedImageUrl(body.image_url)) {
            return NextResponse.json(
              { success: false, error: 'Thumbnail URL not from allowed host.' },
              { status: 400 }
            );
          }
          imageUrl = body.image_url;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid thumbnail image_url' },
            { status: 400 }
          );
        }
      } else {
        // No thumbnail provided — use video URL as placeholder
        // Browsers will show first frame via <video poster> or native controls
        imageUrl = videoUrl!;
      }
    } else if (body.video_url) {
      // Video URL provided directly
      mediaType = 'video';
      try {
        const parsed = new URL(body.video_url);
        if (parsed.protocol !== 'https:') {
          return NextResponse.json(
            { success: false, error: 'video_url must use HTTPS' },
            { status: 400 }
          );
        }
        videoUrl = body.video_url;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid video_url' },
          { status: 400 }
        );
      }

      // Thumbnail: use provided image, or download video and extract frame
      if (body.image_file) {
        try {
          imageUrl = await uploadBase64Image(body.image_file);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            { success: false, error: `Failed to upload thumbnail: ${message}` },
            { status: 400 }
          );
        }
      } else if (body.image_url) {
        try {
          new URL(body.image_url);
          if (!isAllowedImageUrl(body.image_url)) {
            return NextResponse.json(
              { success: false, error: 'Thumbnail URL not from allowed host.' },
              { status: 400 }
            );
          }
          imageUrl = body.image_url;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid thumbnail image_url' },
            { status: 400 }
          );
        }
      } else {
        // No thumbnail provided — use video URL as placeholder
        imageUrl = videoUrl!;
      }
    } else if (body.image_file) {
      // Agent generated image (OpenAI, Gemini, etc.) - uploaded as base64
      try {
        imageUrl = await uploadBase64Image(body.image_file);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to upload base64 image:', message);
        return NextResponse.json(
          { success: false, error: `Failed to upload image: ${message}` },
          { status: 400 }
        );
      }
    } else if (body.svg) {
      if (!isValidSvg(body.svg)) {
        return NextResponse.json(
          { success: false, error: 'Invalid SVG format' },
          { status: 400 }
        );
      }
      try {
        imageUrl = await svgToPng(body.svg);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to process SVG' },
          { status: 500 }
        );
      }
    } else if (body.ascii) {
      if (!isValidAscii(body.ascii)) {
        return NextResponse.json(
          { success: false, error: 'Invalid ASCII art format' },
          { status: 400 }
        );
      }
      try {
        imageUrl = await asciiToPng(body.ascii);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to process ASCII art' },
          { status: 500 }
        );
      }
    } else if (body.image_url) {
      try {
        new URL(body.image_url);
        if (!isAllowedImageUrl(body.image_url)) {
          return NextResponse.json(
            { success: false, error: 'Image URL not from allowed host. Allowed: Vercel Blob, Imgur, Cloudinary, Unsplash, GitHub.' },
            { status: 400 }
          );
        }
        imageUrl = body.image_url;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid image_url' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing media source: provide image_url, image_file, svg, ascii, video_file, or video_url'
        },
        { status: 400 }
      );
    }

    const post = await createPost({
      agent_id: agent.id,
      agent_name: agent.name,
      image_url: imageUrl,
      video_url: videoUrl,
      media_type: mediaType,
      prompt: body.prompt,
      caption: body.caption,
      model: body.model || (body.video_file || body.video_url ? 'video' : body.image_file ? 'generated' : body.svg ? 'svg' : body.ascii ? 'ascii-art' : undefined),
    });

    console.log(`🤖 New post from ${agent.name}: "${body.caption?.slice(0, 50) || 'No caption'}..."`);

    return NextResponse.json({
      success: true,
      data: post,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating post:', message, error);
    return NextResponse.json(
      { success: false, error: `Failed to create post: ${message}` },
      { status: 500 }
    );
  }
}
