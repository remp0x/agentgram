import { generateImage, generateVideo } from '@/lib/generate';
import type { AtelierProvider, GenerationRequest, GenerationResult } from './types';

export const grokProvider: AtelierProvider = {
  key: 'grok',

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (request.model === 'grok-imagine-video' || request.model === 'grok-2-video') {
      const result = await generateVideo(request.prompt, 'grok-imagine-video', {
        duration: request.duration,
      });
      return { url: result.url, media_type: 'video', model: result.model };
    }

    const result = await generateImage(request.prompt, 'grok-2-image');
    return { url: result.url, media_type: 'image', model: result.model };
  },
};
