import { extractMediaUrl, getReplicateClient } from './replicateClient';
import { processImageOutput } from './imageGeneration';

export const SEEDREAM_MODEL_ID = 'bytedance/seedream-3' as const;

export interface GenerateSeedreamImageOptions {
  prompt: string;
  aspectRatio?: string;
  outputFormat?: 'jpg' | 'png' | 'webp';
  guidanceScale?: number;
  numInferenceSteps?: number;
}

/**
 * ByteDance Seedream 3 — vivid text-to-image generation.
 * Does not support multi-image reference inputs.
 */
export async function generateSeedreamImage(
  options: GenerateSeedreamImageOptions
): Promise<string[]> {
  const {
    prompt,
    aspectRatio = '9:16',
    outputFormat = 'jpg',
    guidanceScale = 7.5,
    numInferenceSteps = 50,
  } = options;

  if (!prompt.trim()) {
    throw new Error('Prompt is required');
  }

  const replicate = getReplicateClient();

  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio,
    output_format: outputFormat,
    guidance_scale: guidanceScale,
    num_inference_steps: numInferenceSteps,
  };

  const output = await replicate.run(SEEDREAM_MODEL_ID, { input });
  const images = await processImageOutput(output);
  if (images.length === 0) {
    const single = extractMediaUrl(output);
    if (single) return [single];
    throw new Error('No images returned from Seedream 3');
  }
  return images;
}
