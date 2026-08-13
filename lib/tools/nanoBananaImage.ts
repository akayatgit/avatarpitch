import {
  extractMediaUrl,
  getReplicateClient,
  prepareImageInputs,
} from './replicateClient';
import { processImageOutput } from './imageGeneration';

export const NANO_BANANA_MODEL_ID = 'google/nano-banana-2' as const;
export const NANO_BANANA_ASPECT_RATIO = '9:16' as const;

export type NanoBananaResolution = '1K' | '2K' | '4K';

export interface GenerateNanoBananaImageOptions {
  prompt: string;
  /** Reference images → `image_input` */
  referenceImageUrls?: string[];
  resolution?: NanoBananaResolution;
  aspectRatio?: string;
  /** Google Image Search grounding (also enables web search context) */
  imageSearch?: boolean;
  /** Google Web Search grounding */
  googleSearch?: boolean;
  outputFormat?: 'jpg' | 'png';
}

/**
 * Google Nano Banana 2 — used for suggestion/draft stills.
 * Grounding: image_search + google_search on by default for suggestions.
 */
export async function generateNanoBananaImage(
  options: GenerateNanoBananaImageOptions
): Promise<string[]> {
  const {
    prompt,
    referenceImageUrls = [],
    resolution = '2K',
    aspectRatio = NANO_BANANA_ASPECT_RATIO,
    imageSearch = true,
    googleSearch = true,
    outputFormat = 'jpg',
  } = options;

  if (!prompt.trim()) {
    throw new Error('Prompt is required');
  }

  const replicate = getReplicateClient();
  const imageInput = prepareImageInputs(
    Array.isArray(referenceImageUrls) ? referenceImageUrls.filter(Boolean) : []
  );

  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    resolution: resolution === '1K' || resolution === '4K' ? resolution : '2K',
    aspect_ratio: aspectRatio,
    image_input: imageInput,
    image_search: Boolean(imageSearch),
    google_search: Boolean(googleSearch),
    output_format: outputFormat === 'png' ? 'png' : 'jpg',
  };

  const output = await replicate.run(NANO_BANANA_MODEL_ID, { input });
  const images = await processImageOutput(output);
  if (images.length === 0) {
    // Some runs return a single string URL
    const single = extractMediaUrl(output);
    if (single) return [single];
    throw new Error('No images returned from Nano Banana 2');
  }
  return images;
}
