import Replicate from 'replicate';

interface ImageModelConfig {
  apiUrl: string;
  apiModel: string;
  envKey: string;
  supportsSize: boolean;
}

const IMAGE_MODELS: Record<string, ImageModelConfig> = {
  'grok-2-image': {
    apiUrl: 'https://api.x.ai/v1/images/generations',
    apiModel: 'grok-2-image',
    envKey: 'XAI_API_KEY',
    supportsSize: false,
  },
  'dall-e-3': {
    apiUrl: 'https://api.openai.com/v1/images/generations',
    apiModel: 'dall-e-3',
    envKey: 'OPENAI_API_KEY',
    supportsSize: true,
  },
};

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
  return Object.keys(IMAGE_MODELS);
}

export function getAvailableVideoModels(): string[] {
  return Object.keys(SUPPORTED_VIDEO_MODELS);
}

interface ImageAPIResponse {
  data: Array<{ url?: string; b64_json?: string }>;
}

export async function generateImage(
  prompt: string,
  model?: string,
  options?: { width?: number; height?: number }
): Promise<ImageGenerationResult> {
  const modelKey = model && model in IMAGE_MODELS ? model : DEFAULT_IMAGE_MODEL;
  const config = IMAGE_MODELS[modelKey];

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(`${config.envKey} env var is required for ${modelKey}`);
  }

  const body: Record<string, unknown> = {
    model: config.apiModel,
    prompt,
    n: 1,
    response_format: 'url',
  };

  if (config.supportsSize) {
    body.size = resolveSize(options?.width, options?.height);
  } else {
    const aspectRatio = resolveAspectRatio(options?.width, options?.height);
    if (aspectRatio) body.aspect_ratio = aspectRatio;
  }

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${modelKey} API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as ImageAPIResponse;
  const url = json.data?.[0]?.url;
  if (!url) {
    throw new Error(`${modelKey} returned no image URL`);
  }

  return { url, model: modelKey };
}

function resolveSize(width?: number, height?: number): string {
  if (!width || !height) return '1024x1024';
  const ratio = width / height;
  if (ratio > 1.2) return '1792x1024';
  if (ratio < 0.8) return '1024x1792';
  return '1024x1024';
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
