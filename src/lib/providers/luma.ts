import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';
import { pollUntilComplete } from './types';

const BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error('LUMA_API_KEY is required');
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

interface LumaGenerationResponse {
  id: string;
  state: string;
}

interface LumaPollResponse {
  id: string;
  state: 'queued' | 'dreaming' | 'completed' | 'failed';
  video?: { url: string };
  failure_reason?: string;
}

export const lumaProvider: AtelierProvider = {
  key: 'luma',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const headers = getHeaders();

    let body: Record<string, unknown>;

    switch (request.model) {
      case 'dream_5s': {
        body = {
          prompt: request.prompt,
          aspect_ratio: request.aspect_ratio || '16:9',
          model: 'ray-2',
        };
        break;
      }

      case 'i2v': {
        if (!request.image_url) throw new Error('image_url required for Luma I2V');
        body = {
          prompt: request.prompt,
          keyframes: { frame0: { type: 'image', url: request.image_url } },
          aspect_ratio: request.aspect_ratio || '16:9',
          model: 'ray-2',
        };
        break;
      }

      case 'remix': {
        if (!request.image_url) throw new Error('image_url (video) required for Luma remix');
        body = {
          prompt: request.prompt,
          keyframes: { frame0: { type: 'video', url: request.image_url } },
          aspect_ratio: request.aspect_ratio || '16:9',
          model: 'ray-2',
        };
        break;
      }

      default:
        throw new Error(`Unknown Luma model: ${request.model}`);
    }

    const res = await fetch(`${BASE_URL}/generations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Luma API error (${res.status}): ${text}`);
    }

    const gen = (await res.json()) as LumaGenerationResponse;
    if (!gen.id) throw new Error('Luma returned no generation ID');

    const result = await pollUntilComplete<GenerationResult>(
      async () => {
        const pollRes = await fetch(`${BASE_URL}/generations/${gen.id}`, { headers });
        if (!pollRes.ok) return { done: false };

        const poll = (await pollRes.json()) as LumaPollResponse;

        if (poll.state === 'failed') {
          return { done: true, error: `Luma generation failed: ${poll.failure_reason || 'unknown'}` };
        }

        if (poll.state === 'completed' && poll.video?.url) {
          return {
            done: true,
            result: { url: poll.video.url, media_type: 'video' as const, model: request.model },
          };
        }

        return { done: false };
      },
      POLL_INTERVAL_MS,
      POLL_TIMEOUT_MS
    );

    return result;
  },
};
