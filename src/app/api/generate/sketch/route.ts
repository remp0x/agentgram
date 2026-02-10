import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, createPost } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';
import { uploadBase64Image } from '@/lib/image-utils';
import { renderSketch } from '@/lib/sketch-runtime';
import { triggerCoinMint } from '@/lib/zora';

const MAX_CODE_SIZE = 50 * 1024;
const MAX_CAPTION_LENGTH = 500;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipRateLimit = rateLimiters.sketchGeneration(request);
  if (ipRateLimit) return ipRateLimit;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
      { status: 401 }
    );
  }

  const agent = await getAgentByApiKey(authHeader.substring(7));
  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    );
  }

  const agentRateLimit = rateLimiters.sketchGenerationByAgent(agent.id);
  if (agentRateLimit) return agentRateLimit;

  if (agent.verified !== 1) {
    return NextResponse.json(
      { success: false, error: 'Agent not verified. Complete verification before generating.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const code = body.code as string | undefined;
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'code is required' },
      { status: 400 }
    );
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE) {
    return NextResponse.json(
      { success: false, error: `Code too large (max ${MAX_CODE_SIZE / 1024}KB)` },
      { status: 400 }
    );
  }

  const caption = body.caption as string | undefined;
  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Caption too long (max ${MAX_CAPTION_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const width = typeof body.width === 'number' ? body.width : 800;
  const height = typeof body.height === 'number' ? body.height : 800;
  const seed = typeof body.seed === 'number' ? body.seed : undefined;

  try {
    const pngBuffer = await renderSketch(code, width, height, seed);
    const base64 = pngBuffer.toString('base64');
    const imageUrl = await uploadBase64Image(base64);

    const post = await createPost({
      agent_id: agent.id,
      agent_name: agent.name,
      image_url: imageUrl,
      media_type: 'image',
      prompt: code,
      caption,
      model: 'p5-sketch',
    });

    triggerCoinMint(post, agent.name, agent.id);

    console.log(`🎨 Sketch post from ${agent.name}: "${caption?.slice(0, 50) || 'untitled'}"`);

    return NextResponse.json({
      success: true,
      data: {
        post,
        image_url: imageUrl,
        model: 'p5-sketch',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sketch generation failed:', message, error);

    const status = message.includes('Forbidden pattern')
      || message.includes('timed out')
      || message.includes('element limit')
      || message.includes('Code too large')
      ? 400
      : 500;

    return NextResponse.json(
      { success: false, error: `Sketch generation failed: ${message}` },
      { status }
    );
  }
}
