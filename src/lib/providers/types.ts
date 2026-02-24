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

const RETRYABLE_PATTERNS = ['503', '429', 'ECONNRESET'];
const RETRY_BASE_MS = 2000;

export async function generateWithRetry(
  provider: AtelierProvider,
  request: GenerationRequest,
  maxAttempts = 3,
): Promise<GenerationResult> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await provider.generate(request);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      const retryable = RETRYABLE_PATTERNS.some((p) => msg.includes(p));

      if (!retryable || attempt === maxAttempts) throw lastError;

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError!;
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
