import {
  extractMediaUrl,
  getReplicateClient,
  prepareGrokImageInput,
} from './replicateClient';
import { clampSeedancePrompt } from './seedancePrompt';
import { getVideoModel } from './videoModels';

export const DEFAULT_GROK_ASPECT_RATIO = '9:16' as const;

export interface GenerateGrokImagineVideoOptions {
  prompt: string;
  /** First frame — Grok Imagine 1.5 is image-to-video (single image). */
  image: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: '720p' | '480p';
}

/**
 * xAI Grok Imagine Video 1.5 via Replicate — single image + motion prompt.
 * Image is always attached as jpeg/png/webp (data URI or URL with extension).
 */
export async function generateGrokImagineVideo(
  options: GenerateGrokImagineVideoOptions
): Promise<string> {
  const {
    prompt,
    image,
    duration = 12,
    aspectRatio = DEFAULT_GROK_ASPECT_RATIO,
    resolution = '720p',
  } = options;

  if (!prompt.trim()) {
    throw new Error('Prompt is required');
  }
  if (!image) {
    throw new Error('A starting image is required for Grok Imagine');
  }

  const model = getVideoModel('grok-imagine-1.5');
  const replicate = getReplicateClient();
  // Never pass a bare Buffer — Grok rejects uploads without .jpeg/.jpg/.png/.webp
  const preparedImage = await prepareGrokImageInput(image);
  const videoDuration = Math.min(Math.max(Math.round(duration), 1), 15);

  const input: Record<string, unknown> = {
    prompt: clampSeedancePrompt(prompt),
    image: preparedImage,
    duration: videoDuration,
    aspect_ratio: aspectRatio,
    resolution: resolution === '480p' ? '480p' : '720p',
  };

  const output = await replicate.run(model.replicateModel, { input });
  const videoUrl = extractMediaUrl(output);
  if (!videoUrl) {
    throw new Error('Unexpected output format from Grok Imagine - no valid video URL found');
  }
  return videoUrl;
}
