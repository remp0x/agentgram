import Replicate from 'replicate';

const XAI_API_URL = 'https://api.x.ai/v1/images/generations';

const SUPPORTED_IMAGE_MODELS = ['grok-2-image'] as const;
const DEFAULT_IMAGE_MODEL = 'grok-2-image';

const SUPPORTED_VIDEO_MODELS: Record<string, string> = {
  'minimax-video': 'minimax/video-01',
  'wan-2.1': 'wan-video/wan-2.1-t2v',
};
const DEFAULT_VIDEO_MODEL = 'minimax-video';

export interface ImageGenerationResult {
  url: string;
  model: string;
}

export interface VideoGenerationResult {
  url: string;
  model: string;
}

export function getAvailableImageModels(): string[] {
  return [...SUPPORTED_IMAGE_MODELS];
}

export function getAvailableVideoModels(): string[] {
  return Object.keys(SUPPORTED_VIDEO_MODELS);
}

interface XAIImageResponse {
  data: Array<{ url?: string; b64_json?: string }>;
}

export async function generateImage(
  prompt: string,
  _model?: string,
  options?: { width?: number; height?: number }
): Promise<ImageGenerationResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY env var is required for image generation');
  }

  const aspectRatio = resolveAspectRatio(options?.width, options?.height);

  const res = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-image',
      prompt,
      n: 1,
      response_format: 'url',
      ...(aspectRatio && { aspect_ratio: aspectRatio }),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as XAIImageResponse;
  const url = json.data?.[0]?.url;
  if (!url) {
    throw new Error('xAI returned no image URL');
  }

  return { url, model: DEFAULT_IMAGE_MODEL };
}

function resolveAspectRatio(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  if (ratio > 1.7) return '16:9';
  if (ratio > 1.2) return '4:3';
  if (ratio < 0.6) return '9:16';
  if (ratio < 0.8) return '3:4';
  return '1:1';
}

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN env var is required for video generation');
  }
  return new Replicate({ auth: token });
}

export async function generateVideo(
  prompt: string,
  model?: string,
  options?: { duration?: number }
): Promise<VideoGenerationResult> {
  const modelKey = model && model in SUPPORTED_VIDEO_MODELS ? model : DEFAULT_VIDEO_MODEL;
  const replicateModel = SUPPORTED_VIDEO_MODELS[modelKey];
  const replicate = getReplicate();

  const input: Record<string, unknown> = { prompt };
  if (options?.duration) input.duration = options.duration;

  const output = await replicate.run(
    replicateModel as `${string}/${string}`,
    { input }
  );

  const url = extractUrl(output);
  if (!url) {
    throw new Error('Generation returned no output');
  }

  return { url, model: modelKey };
}

function extractUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'url' in output) {
    return (output as { url: string }).url;
  }
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) {
      return (first as { url: string }).url;
    }
  }
  return null;
}
