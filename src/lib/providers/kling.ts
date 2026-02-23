import jwt from 'jsonwebtoken';
import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';
import { pollUntilComplete } from './types';

const BASE_URL = 'https://api-singapore.klingai.com';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

function createJwt(): string {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
    iat: now,
  };

  return jwt.sign(payload, secretKey, {
    algorithm: 'HS256',
    header: { alg: 'HS256', typ: 'JWT' },
  });
}

async function klingFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = createJwt();
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

interface KlingTaskResponse {
  code: number;
  data: { task_id: string };
}

interface KlingPollResponse {
  code: number;
  data: {
    task_status: 'submitted' | 'processing' | 'succeed' | 'failed';
    task_result?: {
      videos?: Array<{ url: string; duration: string }>;
      images?: Array<{ url: string }>;
    };
    task_status_msg?: string;
  };
}

async function submitAndPoll(
  submitPath: string,
  pollBasePath: string,
  body: Record<string, unknown>,
  mediaType: 'image' | 'video',
  model: string
): Promise<GenerationResult> {
  const res = await klingFetch(submitPath, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kling API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as KlingTaskResponse;
  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(`Kling submit failed: ${JSON.stringify(json)}`);
  }

  const taskId = json.data.task_id;
  const pollPath = `${pollBasePath}/${taskId}`;

  const result = await pollUntilComplete<GenerationResult>(
    async () => {
      const pollRes = await klingFetch(pollPath);
      if (!pollRes.ok) {
        return { done: false };
      }
      const poll = (await pollRes.json()) as KlingPollResponse;
      const status = poll.data?.task_status;

      if (status === 'failed') {
        return { done: true, error: `Kling generation failed: ${poll.data?.task_status_msg || 'unknown'}` };
      }

      if (status === 'succeed') {
        const taskResult = poll.data.task_result;
        if (mediaType === 'video' && taskResult?.videos?.[0]?.url) {
          return {
            done: true,
            result: {
              url: taskResult.videos[0].url,
              media_type: 'video' as const,
              model,
              duration_seconds: parseFloat(taskResult.videos[0].duration) || undefined,
            },
          };
        }
        if (mediaType === 'image' && taskResult?.images?.[0]?.url) {
          return {
            done: true,
            result: { url: taskResult.images[0].url, media_type: 'image' as const, model },
          };
        }
        return { done: true, error: 'Kling returned no media URL' };
      }

      return { done: false };
    },
    POLL_INTERVAL_MS,
    POLL_TIMEOUT_MS
  );

  return result;
}

export const klingProvider: AtelierProvider = {
  key: 'kling',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    switch (request.model) {
      case 't2v_5s':
      case 't2v_10s': {
        const duration = request.model === 't2v_10s' ? '10' : '5';
        return submitAndPoll(
          '/v1/videos/text2video',
          '/v1/videos/text2video',
          {
            model_name: 'kling-v2-master',
            prompt: request.prompt,
            duration,
            aspect_ratio: request.aspect_ratio || '16:9',
          },
          'video',
          request.model
        );
      }

      case 'i2v': {
        if (!request.image_url) throw new Error('image_url required for Kling I2V');
        return submitAndPoll(
          '/v1/videos/image2video',
          '/v1/videos/image2video',
          {
            model_name: 'kling-v2-master',
            image: request.image_url,
            prompt: request.prompt,
            duration: '5',
            aspect_ratio: request.aspect_ratio || '16:9',
          },
          'video',
          request.model
        );
      }

      case 'image': {
        return submitAndPoll(
          '/v1/images/generations',
          '/v1/images/generations',
          {
            model_name: 'kling-v2',
            prompt: request.prompt,
            aspect_ratio: request.aspect_ratio || '16:9',
            n: 1,
          },
          'image',
          request.model
        );
      }

      case 'talking_avatar': {
        if (!request.image_url) throw new Error('image_url required for Kling talking avatar');
        if (!request.audio_url) throw new Error('audio_url required for Kling talking avatar');
        return submitAndPoll(
          '/v1/videos/avatar',
          '/v1/videos/avatar',
          {
            model_name: 'kling-v2-master',
            image: request.image_url,
            audio: request.audio_url,
          },
          'video',
          request.model
        );
      }

      default:
        throw new Error(`Unknown Kling model: ${request.model}`);
    }
  },
};
