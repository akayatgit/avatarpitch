import {
  extractMediaUrl,
  getReplicateClient,
  prepareImageInputs,
} from './replicateClient';

export const IMAGE_MODEL_ID = 'openai/gpt-image-2' as const;
export const IMAGE_ASPECT_RATIO = '9:16' as const;
/** 480p = low; 720p/2K = medium; 3K = high */
export type ImageSize = '480p' | '720p' | '2K' | '3K';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageStyleMode = 'aerial' | 'scene' | 'none';

const AERIAL_SUFFIX =
  'Photorealistic high-angle aerial drone view showing the entire location and all its landmarks together in one frame, clear geography and spatial layout, golden-hour sunset light, HDR, realistic atmospheric haze, highly detailed architecture, natural colors, sharp focus, 8K quality. No text, no labels, no map markers, no watermarks.';

const SCENE_SUFFIX =
  'Photorealistic cinematic still suitable as a locked first frame for a continuous camera take, clear subject and environment, dramatic lighting matching the description, highly detailed, natural colors, sharp focus, 8K quality. No text, no labels, no watermarks, no storyboard annotations.';

export interface GenerateImageOptions {
  prompt: string;
  referenceImageUrls?: string[];
  size?: ImageSize;
  numImages?: number;
  /** Append style suffix for the workflow base still */
  mode?: ImageStyleMode;
}

export function resolveImageQuality(size: ImageSize = '2K'): ImageQuality {
  if (size === '480p') return 'low';
  if (size === '3K') return 'high';
  // 720p and 2K → medium
  return 'medium';
}

function enforcePromptStyle(prompt: string, mode: ImageStyleMode): string {
  let result = prompt.trim();
  if (mode === 'aerial') {
    if (!/aerial/i.test(result) || !/golden-hour/i.test(result)) {
      result = `${result.replace(/\.?\s*$/, '.')} ${AERIAL_SUFFIX}`;
    }
  } else if (mode === 'scene') {
    if (!/photorealistic/i.test(result) && !/cinematic/i.test(result)) {
      result = `${result.replace(/\.?\s*$/, '.')} ${SCENE_SUFFIX}`;
    }
  }
  return result;
}

export function buildGptImage2Input({
  prompt,
  referenceImageUrls = [],
  size = '2K',
  numImages = 1,
  mode = 'none',
}: GenerateImageOptions) {
  const inputImages = prepareImageInputs(
    Array.isArray(referenceImageUrls) ? referenceImageUrls : []
  );

  const input: Record<string, any> = {
    prompt: enforcePromptStyle(prompt, mode),
    aspect_ratio: IMAGE_ASPECT_RATIO,
    number_of_images: Math.min(Math.max(numImages, 1), 10),
    quality: resolveImageQuality(size),
    output_format: 'png',
  };

  if (inputImages.length > 0) {
    input.input_images = inputImages;
  }

  return input;
}

export async function processImageOutput(output: unknown): Promise<string[]> {
  const items = Array.isArray(output) ? output : [output];
  const urls: string[] = [];
  for (const item of items) {
    const url = extractMediaUrl(item);
    if (url) urls.push(url);
  }
  return urls;
}

/** Reusable image generation tool — all workflows call this. */
export async function generateImage(options: GenerateImageOptions): Promise<string[]> {
  const replicate = getReplicateClient();
  const input = buildGptImage2Input(options);
  const output = await replicate.run(IMAGE_MODEL_ID, { input });
  const images = await processImageOutput(output);
  if (images.length === 0) {
    throw new Error('No images returned from GPT Image 2');
  }
  return images;
}

/** @deprecated use extractMediaUrl — kept for older imports */
export function normalizeImageUrl(value: unknown): string | null {
  return extractMediaUrl(value);
}
