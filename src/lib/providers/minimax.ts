import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';
import { pollUntilComplete } from './types';

const BASE_URL = 'https://api.minimax.io/v1';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY is required');
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

interface MiniMaxCreateResponse {
  task_id: string;
  base_resp?: { status_code: number; status_msg: string };
}

interface MiniMaxPollResponse {
  task_id: string;
  status: 'Queueing' | 'Processing' | 'Success' | 'Fail';
  file_id?: string;
  base_resp?: { status_code: number; status_msg: string };
}

interface MiniMaxFileResponse {
  file: { download_url: string };
  base_resp?: { status_code: number; status_msg: string };
}

export const minimaxProvider: AtelierProvider = {
  key: 'minimax',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const headers = getHeaders();

    const modelName = request.model === 'hailuo_pro' ? 'MiniMax-Hailuo-2.3' : 'MiniMax-Hailuo-2.3-Fast';

    const body: Record<string, unknown> = {
      model: modelName,
      prompt: request.prompt,
    };

    if (request.image_url) {
      body.first_frame_image = request.image_url;
    }

    const res = await fetch(`${BASE_URL}/video_generation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MiniMax API error (${res.status}): ${text}`);
    }

    const create = (await res.json()) as MiniMaxCreateResponse;
    if (!create.task_id) {
      throw new Error(`MiniMax submit failed: ${create.base_resp?.status_msg || 'no task_id'}`);
    }

    const fileId = await pollUntilComplete<string>(
      async () => {
        const pollRes = await fetch(
          `${BASE_URL}/query/video_generation?task_id=${create.task_id}`,
          { headers }
        );
        if (!pollRes.ok) return { done: false };

        const poll = (await pollRes.json()) as MiniMaxPollResponse;

        if (poll.status === 'Fail') {
          return { done: true, error: `MiniMax generation failed: ${poll.base_resp?.status_msg || 'unknown'}` };
        }

        if (poll.status === 'Success' && poll.file_id) {
          return { done: true, result: poll.file_id };
        }

        return { done: false };
      },
      POLL_INTERVAL_MS,
      POLL_TIMEOUT_MS
    );

    const fileRes = await fetch(`${BASE_URL}/files/retrieve?file_id=${fileId}`, { headers });
    if (!fileRes.ok) {
      const text = await fileRes.text();
      throw new Error(`MiniMax file retrieve error (${fileRes.status}): ${text}`);
    }

    const fileData = (await fileRes.json()) as MiniMaxFileResponse;
    if (!fileData.file?.download_url) {
      throw new Error('MiniMax returned no download URL');
    }

    return {
      url: fileData.file.download_url,
      media_type: 'video',
      model: request.model,
    };
  },
};
