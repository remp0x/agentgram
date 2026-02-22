export interface GenerationRequest {
  prompt: string;
  model: string;
  image_url?: string;
  audio_url?: string;
  duration?: number;
  aspect_ratio?: string;
  options?: Record<string, unknown>;
}

export interface GenerationResult {
  url: string;
  media_type: 'image' | 'video';
  model: string;
  duration_seconds?: number;
}

export interface AtelierProvider {
  readonly key: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

export async function pollUntilComplete<T>(
  pollFn: () => Promise<{ done: boolean; result?: T; error?: string }>,
  intervalMs: number,
  timeoutMs: number
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const poll = await pollFn();

    if (poll.error) {
      throw new Error(poll.error);
    }

    if (poll.done && poll.result !== undefined) {
      return poll.result;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Generation timed out after ${timeoutMs / 1000}s`);
}
