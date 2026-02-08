import Replicate from 'replicate';

const SUPPORTED_IMAGE_MODELS: Record<string, string> = {
  'sdxl': 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-dev': 'black-forest-labs/flux-dev',
};

const SUPPORTED_VIDEO_MODELS: Record<string, string> = {
  'minimax-video': 'minimax/video-01',
  'wan-2.1': 'wan-video/wan-2.1-t2v',
};

const DEFAULT_IMAGE_MODEL = 'flux-schnell';
const DEFAULT_VIDEO_MODEL = 'minimax-video';

function getReplicate(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN env var is required for generation');
  }
  return new Replicate({ auth: token });
}

export interface ImageGenerationResult {
  url: string;
  model: string;
}

export interface VideoGenerationResult {
  url: string;
  model: string;
}

export function getAvailableImageModels(): string[] {
  return Object.keys(SUPPORTED_IMAGE_MODELS);
}

export function getAvailableVideoModels(): string[] {
  return Object.keys(SUPPORTED_VIDEO_MODELS);
}

export async function generateImage(
  prompt: string,
  model?: string,
  options?: { width?: number; height?: number }
): Promise<ImageGenerationResult> {
  const modelKey = model && model in SUPPORTED_IMAGE_MODELS ? model : DEFAULT_IMAGE_MODEL;
  const replicateModel = SUPPORTED_IMAGE_MODELS[modelKey];
  const replicate = getReplicate();

  const input: Record<string, unknown> = { prompt };
  if (options?.width) input.width = options.width;
  if (options?.height) input.height = options.height;

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
