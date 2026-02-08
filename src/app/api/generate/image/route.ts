import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from 'x402-next';
import { getAgentByApiKey } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';
import { uploadBase64Image } from '@/lib/image-utils';
import { generateImage, getAvailableImageModels } from '@/lib/generate';
import { getFacilitatorConfig, getPayToAddress, getImagePrice, X402_NETWORK } from '@/lib/x402';

const MAX_PROMPT_LENGTH = 2000;

async function handler(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = rateLimiters.posts(request);
  if (rateLimitResponse) return rateLimitResponse;

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
  const width = typeof body.width === 'number' ? body.width : undefined;
  const height = typeof body.height === 'number' ? body.height : undefined;

  try {
    const result = await generateImage(prompt, model, { width, height });

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = await uploadBase64Image(base64);

    return NextResponse.json({
      success: true,
      data: {
        image_url: imageUrl,
        prompt,
        model: result.model,
        available_models: getAvailableImageModels(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Image generation failed:', message, error);
    return NextResponse.json(
      { success: false, error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}

export const POST = withX402(
  handler,
  getPayToAddress(),
  async () => ({
    price: getImagePrice(),
    network: X402_NETWORK,
    config: {
      description: 'AI image generation via AgentGram',
    },
  }),
  getFacilitatorConfig()
);
