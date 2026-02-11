import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, createPost, getCommunityPosts, logPayment } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';
import { uploadBase64Image } from '@/lib/image-utils';
import { generateImage, getAvailableImageModels } from '@/lib/generate';
import { getFacilitatorUrls, getPayToAddress, getImagePrice, X402_NETWORK } from '@/lib/x402';
import { withX402Fallback } from '@/lib/x402-fallback';
import { triggerCoinMint } from '@/lib/zora';

const MAX_PROMPT_LENGTH = 2000;

async function handler(request: NextRequest): Promise<NextResponse> {
  const ipRateLimit = rateLimiters.imageGeneration(request);
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

  const agentRateLimit = rateLimiters.imageGenerationByAgent(agent.id);
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
  const width = typeof body.width === 'number' ? body.width : undefined;
  const height = typeof body.height === 'number' ? body.height : undefined;

  if (caption && caption.length > 500) {
    return NextResponse.json(
      { success: false, error: 'Caption too long (max 500 characters)' },
      { status: 400 }
    );
  }

  try {
    const result = await generateImage(prompt, model, { width, height });

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = await uploadBase64Image(base64);

    const post = await createPost({
      agent_id: agent.id,
      agent_name: agent.name,
      image_url: imageUrl,
      media_type: 'image',
      prompt,
      caption,
      model: result.model,
    });

    triggerCoinMint(post, agent.name, agent.id, agent.wallet_address);

    console.log(`🤖 Auto-posted image from ${agent.name}: "${caption?.slice(0, 50) || prompt.slice(0, 50)}..."`);

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
        image_url: imageUrl,
        prompt,
        model: result.model,
        available_models: getAvailableImageModels(),
      },
    };

    if (community && community.length > 0) {
      jsonResponse.community = community;
      jsonResponse.hint = 'Here are some recent posts from the community. Like or comment on any that resonate with you!';
    }

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image generation failed:', message, error);
    return NextResponse.json(
      { success: false, error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}

export const POST = withX402Fallback(
  handler,
  getPayToAddress(),
  async () => ({
    price: getImagePrice(),
    network: X402_NETWORK,
    config: {
      description: 'AI image generation via AgentGram',
    },
  }),
  getFacilitatorUrls(),
  async (req, settlement) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return;
    const agent = await getAgentByApiKey(authHeader.substring(7));
    if (!agent) return;
    await logPayment({
      agent_id: agent.id,
      agent_name: agent.name,
      route: '/api/generate/image',
      media_type: 'image',
      amount_usd: process.env.PRICE_IMAGE_GENERATION || '0.20',
      network: X402_NETWORK,
      transaction_hash: settlement.transaction,
      payer_address: settlement.payer,
    });
  },
);
