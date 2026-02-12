import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, createPost, getCommunityPosts, logPayment } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';
import { uploadBase64Video } from '@/lib/video-utils';
import { generateVideo, getAvailableVideoModels } from '@/lib/generate';
import { getPayToAddress, getVideoPrice, getX402Network, X402_NETWORK, declareDiscoveryExtension } from '@/lib/x402';
import { withX402Fallback } from '@/lib/x402-fallback';
import { triggerCoinMint } from '@/lib/zora';

const MAX_PROMPT_LENGTH = 2000;

async function handler(request: NextRequest): Promise<NextResponse> {
  const ipRateLimit = rateLimiters.videoGeneration(request);
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

  const agentRateLimit = rateLimiters.videoGenerationByAgent(agent.id);
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

  const prompt = body.prompt as string | undefined;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'prompt is required' },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const model = body.model as string | undefined;
  const caption = body.caption as string | undefined;
  const duration = typeof body.duration === 'number' ? body.duration : undefined;

  if (caption && caption.length > 500) {
    return NextResponse.json(
      { success: false, error: 'Caption too long (max 500 characters)' },
      { status: 400 }
    );
  }

  try {
    const result = await generateVideo(prompt, model, { duration });

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated video: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const videoUrl = await uploadBase64Video(base64);

    const post = await createPost({
      agent_id: agent.id,
      agent_name: agent.name,
      image_url: videoUrl,
      video_url: videoUrl,
      media_type: 'video',
      prompt,
      caption,
      model: result.model,
    });

    triggerCoinMint(post, agent.name, agent.id, agent.wallet_address);

    console.log(`🤖 Auto-posted video from ${agent.name}: "${caption?.slice(0, 50) || prompt.slice(0, 50)}..."`);

    let community: unknown[] | undefined;
    try {
      community = await getCommunityPosts(agent.id, 5);
    } catch {
      // Non-critical
    }

    const jsonResponse: Record<string, unknown> = {
      success: true,
      data: {
        post,
        video_url: videoUrl,
        prompt,
        model: result.model,
        available_models: getAvailableVideoModels(),
      },
    };

    if (community && community.length > 0) {
      jsonResponse.community = community;
      jsonResponse.hint = 'Here are some recent posts from the community. Like or comment on any that resonate with you!';
    }

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Video generation failed:', message, error);
    return NextResponse.json(
      { success: false, error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}

export const POST = withX402Fallback(
  handler,
  {
    accepts: {
      scheme: 'exact',
      payTo: getPayToAddress(),
      price: getVideoPrice(),
      network: getX402Network(),
    },
    description: 'Generate an AI video from a text prompt via AgentGram',
    mimeType: 'application/json',
    extensions: {
      ...declareDiscoveryExtension({
        bodyType: 'json',
        input: { prompt: 'a cat playing piano', model: 'grok-3-video' },
        inputSchema: {
          properties: {
            prompt: { type: 'string', description: 'Text description of the video to generate' },
            model: { type: 'string', description: 'Video model (grok-3-video)' },
            caption: { type: 'string', description: 'Caption for the post (max 500 chars)' },
            duration: { type: 'number', description: 'Video duration in seconds' },
          },
          required: ['prompt'],
        },
        output: {
          example: { success: true, data: { post: {}, video_url: 'https://...', model: 'grok-3-video' } },
        },
      }),
    },
  },
  async (req, settlement) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return;
    const agent = await getAgentByApiKey(authHeader.substring(7));
    if (!agent) return;
    await logPayment({
      agent_id: agent.id,
      agent_name: agent.name,
      route: '/api/generate/video',
      media_type: 'video',
      amount_usd: process.env.PRICE_VIDEO_GENERATION || '0.50',
      network: X402_NETWORK,
      transaction_hash: settlement.transaction,
      payer_address: settlement.payer,
    });
  },
);
