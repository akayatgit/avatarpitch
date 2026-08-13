import { extractMediaUrl, getReplicateClient } from './replicateClient';
import { prepareSeedanceReferenceImages } from './seedanceImagePrep';
import { clampSeedancePrompt } from './seedancePrompt';

export const VIDEO_MODEL_ID = 'bytedance/seedance-2.0' as const;
export const DEFAULT_VIDEO_ASPECT_RATIO = '9:16' as const;

// Re-export prompt helpers so server callers can keep a single import if needed
export { clampSeedancePrompt, SEEDANCE_PROMPT_MAX_CHARS } from './seedancePrompt';

export interface GenerateVideoOptions {
  prompt: string;
  /** Path / object / style refs — referenced in prompt as [Image1], [Image2], … */
  referenceImages: string[];
  duration?: number;
  resolution?: '720p' | '480p';
  aspectRatio?: string;
  generateAudio?: boolean;
}

/** Reusable Seedance 2.0 tool — server-only (uses sharp for JPEG compression). */
export async function generateVideo(options: GenerateVideoOptions): Promise<string> {
  const {
    prompt,
    referenceImages,
    duration = 12,
    resolution = '720p',
    aspectRatio = DEFAULT_VIDEO_ASPECT_RATIO,
    generateAudio = true,
  } = options;

  if (!prompt.trim()) {
    throw new Error('Prompt is required');
  }
  if (!referenceImages?.length) {
    throw new Error('At least one reference image is required');
  }

  const replicate = getReplicateClient();
  // Seedance E005 is often large/PNG refs — always send compressed JPEG data URIs
  const prepared = await prepareSeedanceReferenceImages(referenceImages);
  const videoDuration = Math.min(Math.max(Math.round(duration), 3), 15);

  const input: Record<string, any> = {
    prompt: clampSeedancePrompt(prompt),
    reference_images: prepared,
    duration: videoDuration,
    resolution: resolution === '480p' ? '480p' : '720p',
    aspect_ratio: aspectRatio,
    generate_audio: generateAudio,
  };

  const output = await replicate.run(VIDEO_MODEL_ID, { input });
  const videoUrl = extractMediaUrl(output);
  if (!videoUrl) {
    throw new Error('Unexpected output format from Replicate - no valid video URL found');
  }
  return videoUrl;
}
