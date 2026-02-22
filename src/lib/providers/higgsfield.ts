import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';
import { pollUntilComplete } from './types';

const BASE_URL = 'https://platform.higgsfield.ai';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

function getAuth(): string {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET are required');
  }
  return `Key ${keyId}:${keySecret}`;
}

function getHeaders(): Record<string, string> {
  return {
    'Authorization': getAuth(),
    'Content-Type': 'application/json',
  };
}

interface HiggsSubmitResponse {
  request_id: string;
}

interface HiggsPollResponse {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
  result?: {
    output_url?: string;
    output?: string;
  };
  error?: string;
}

async function submitAndPoll(
  endpoint: string,
  body: Record<string, unknown>,
  mediaType: 'image' | 'video',
  model: string
): Promise<GenerationResult> {
  const headers = getHeaders();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield API error (${res.status}): ${text}`);
  }

  const submit = (await res.json()) as HiggsSubmitResponse;
  if (!submit.request_id) throw new Error('Higgsfield returned no request_id');

  const result = await pollUntilComplete<GenerationResult>(
    async () => {
      const pollRes = await fetch(`${BASE_URL}/requests/${submit.request_id}/status`, { headers });
      if (!pollRes.ok) return { done: false };

      const poll = (await pollRes.json()) as HiggsPollResponse;

      if (poll.status === 'failed') {
        return { done: true, error: `Higgsfield generation failed: ${poll.error || 'unknown'}` };
      }
      if (poll.status === 'nsfw') {
        return { done: true, error: 'Higgsfield: content flagged as NSFW' };
      }

      if (poll.status === 'completed') {
        const url = poll.result?.output_url || poll.result?.output;
        if (url) {
          return {
            done: true,
            result: { url, media_type: mediaType, model },
          };
        }
        return { done: true, error: 'Higgsfield returned no output URL' };
      }

      return { done: false };
    },
    POLL_INTERVAL_MS,
    POLL_TIMEOUT_MS
  );

  return result;
}

export const higgsFieldProvider: AtelierProvider = {
  key: 'higgsfield',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    switch (request.model) {
      case 'dop_turbo': {
        if (!request.image_url) throw new Error('image_url required for Higgsfield DoP');
        return submitAndPoll(
          '/v1/image2video/dop',
          {
            model: 'dop-turbo',
            image_url: request.image_url,
            prompt: request.prompt,
            aspect_ratio: request.aspect_ratio || '16:9',
          },
          'video',
          request.model
        );
      }

      case 'dop_quality': {
        if (!request.image_url) throw new Error('image_url required for Higgsfield DoP');
        return submitAndPoll(
          '/v1/image2video/dop',
          {
            model: 'dop',
            image_url: request.image_url,
            prompt: request.prompt,
            aspect_ratio: request.aspect_ratio || '16:9',
          },
          'video',
          request.model
        );
      }

      case 'talking_avatar': {
        if (!request.image_url) throw new Error('image_url required for Higgsfield avatar');
        if (!request.audio_url) throw new Error('audio_url required for Higgsfield avatar');
        return submitAndPoll(
          '/v1/speak/higgsfield',
          {
            image_url: request.image_url,
            audio_url: request.audio_url,
          },
          'video',
          request.model
        );
      }

      case 'soul_portrait': {
        return submitAndPoll(
          '/v1/text2image/soul',
          {
            prompt: request.prompt,
            aspect_ratio: request.aspect_ratio || '1:1',
          },
          'image',
          request.model
        );
      }

      default:
        throw new Error(`Unknown Higgsfield model: ${request.model}`);
    }
  },
};
