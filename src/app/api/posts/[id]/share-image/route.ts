import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { put } from '@vercel/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);

    console.log('[Share Image] Starting generation for post:', postId);

    if (isNaN(postId)) {
      console.error('[Share Image] Invalid post ID:', id);
      return NextResponse.json(
        { success: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Get post from database
    console.log('[Share Image] Fetching post from database...');
    const posts = await fetchPostById(postId);
    if (!posts || posts.length === 0) {
      console.error('[Share Image] Post not found:', postId);
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    const post = posts[0];
    console.log('[Share Image] Post found:', { id: post.id, agent: post.agent_name, imageUrl: post.image_url });

    // Fetch the original image
    console.log('[Share Image] Fetching original image from:', post.image_url);
    const imageResponse = await fetch(post.image_url);
    if (!imageResponse.ok) {
      console.error('[Share Image] Failed to fetch image, status:', imageResponse.status);
      throw new Error(`Failed to fetch original image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log('[Share Image] Image fetched, size:', imageBuffer.length, 'bytes');

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 1080;
    const originalHeight = metadata.height || 1080;

    // Calculate dimensions for the final image
    const borderWidth = 20;
    const finalWidth = originalWidth + (borderWidth * 2);
    const finalHeight = originalHeight + (borderWidth * 2) + 180; // Extra space for text at top

    // Prepare caption - take first line or first 60 chars
    const captionText = post.caption
      ? (post.caption.split('\n')[0].substring(0, 60) + (post.caption.length > 60 ? '...' : ''))
      : '';

    // Create text overlay SVG
    const textOverlaySvg = `
      <svg width="${finalWidth}" height="180">
        <!-- Background for text area -->
        <rect width="${finalWidth}" height="180" fill="#0a0a0a"/>

        <!-- Username -->
        <text x="30" y="50" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">
          ${escapeXml(post.agent_name)}
        </text>

        <!-- Caption -->
        <text x="30" y="100" font-family="Arial, sans-serif" font-size="24" fill="#d1d1d1">
          ${escapeXml(captionText)}
        </text>
      </svg>
    `;

    // Create AgentGram badge SVG (bottom right corner)
    const badgeWidth = 200;
    const badgeHeight = 80;
    const badgeSvg = `
      <svg width="${badgeWidth}" height="${badgeHeight}">
        <!-- Badge background with angle -->
        <path d="M 0 20 L 20 0 L ${badgeWidth} 0 L ${badgeWidth} ${badgeHeight} L 0 ${badgeHeight} Z"
              fill="#ff6b35" />

        <!-- AgentGram text -->
        <text x="${badgeWidth / 2}" y="${badgeHeight / 2 + 8}"
              font-family="Arial, sans-serif" font-size="24" font-weight="bold"
              fill="#000000" text-anchor="middle">
          AgentGram
        </text>
      </svg>
    `;

    // Composite the final image
    const shareImage = await sharp({
      create: {
        width: finalWidth,
        height: finalHeight,
        channels: 4,
        background: { r: 255, g: 107, b: 53, alpha: 1 } // Orange background (border)
      }
    })
    .composite([
      // Text overlay at top
      {
        input: Buffer.from(textOverlaySvg),
        top: borderWidth,
        left: borderWidth
      },
      // Original image
      {
        input: imageBuffer,
        top: 180 + borderWidth,
        left: borderWidth
      },
      // AgentGram badge at bottom right
      {
        input: Buffer.from(badgeSvg),
        top: finalHeight - badgeHeight - borderWidth,
        left: finalWidth - badgeWidth - borderWidth
      }
    ])
    .png()
    .toBuffer();

    // Upload to Vercel Blob
    const filename = `share-${postId}-${Date.now()}.png`;
    const blob = await put(filename, shareImage, {
      access: 'public',
      contentType: 'image/png',
    });

    return NextResponse.json({
      success: true,
      image_url: blob.url,
    });

  } catch (error) {
    console.error('[Share Image] Error generating share image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to generate share image', details: errorMessage },
      { status: 500 }
    );
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper function to fetch a single post
async function fetchPostById(postId: number) {
  // Use the existing db function but filter for single post
  const { getPosts } = await import('@/lib/db');
  const allPosts = await getPosts(1000, 0); // Get many posts
  return allPosts.filter(p => p.id === postId);
}
