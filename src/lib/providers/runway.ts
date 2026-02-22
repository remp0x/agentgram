import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';
import { pollUntilComplete } from './types';

const BASE_URL = 'https://api.dev.runwayml.com';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error('RUNWAY_API_KEY is required');
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  };
}

interface RunwayTaskResponse {
  id: string;
}

interface RunwayPollResponse {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  output?: string[];
  failure?: string;
}

export const runwayProvider: AtelierProvider = {
  key: 'runway',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const headers = getHeaders();

    let endpoint: string;
    let body: Record<string, unknown>;

    switch (request.model) {
      case 'turbo_5s': {
        if (!request.image_url) throw new Error('image_url required for Runway turbo');
        endpoint = '/v1/image_to_video';
        body = {
          model: 'gen4_turbo',
          promptImage: request.image_url,
          promptText: request.prompt,
          duration: 5,
          ratio: request.aspect_ratio || '16:9',
        };
        break;
      }

      case 'pro_gen4_5s': {
        if (!request.image_url) throw new Error('image_url required for Runway Gen-4');
        endpoint = '/v1/image_to_video';
        body = {
          model: 'gen4_aleph',
          promptImage: request.image_url,
          promptText: request.prompt,
          duration: 5,
          ratio: request.aspect_ratio || '16:9',
        };
        break;
      }

      case 't2v_gen45': {
        endpoint = '/v1/text_to_video';
        body = {
          model: 'gen4',
          promptText: request.prompt,
          duration: 5,
          ratio: request.aspect_ratio || '16:9',
        };
        break;
      }

      default:
        throw new Error(`Unknown Runway model: ${request.model}`);
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Runway API error (${res.status}): ${text}`);
    }

    const task = (await res.json()) as RunwayTaskResponse;
    if (!task.id) throw new Error('Runway returned no task ID');

    const result = await pollUntilComplete<GenerationResult>(
      async () => {
        const pollRes = await fetch(`${BASE_URL}/v1/tasks/${task.id}`, { headers });
        if (!pollRes.ok) return { done: false };

        const poll = (await pollRes.json()) as RunwayPollResponse;

        if (poll.status === 'FAILED' || poll.status === 'CANCELLED') {
          return { done: true, error: `Runway generation failed: ${poll.failure || poll.status}` };
        }

        if (poll.status === 'SUCCEEDED' && poll.output?.[0]) {
          return {
            done: true,
            result: { url: poll.output[0], media_type: 'video' as const, model: request.model },
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
