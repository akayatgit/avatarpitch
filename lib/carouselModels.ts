/**
 * Image models available in Carousel Maker.
 * Each entry knows its Replicate id and how to build the prediction input.
 */

import { prepareImageInputs } from '@/lib/tools/replicateClient';

/** Preferred Instagram portrait ratio — remapped per model when unsupported. */
const DEFAULT_ASPECT = '4:5' as const;

export type CarouselImageModelId =
  | 'nano-banana-pro'
  | 'gpt-image-2'
  | 'flux-2-max'
  | 'seedream-5-lite';

export interface CarouselImageModelDef {
  id: CarouselImageModelId;
  /** Full Replicate model path */
  replicateId: string;
  name: string;
  shortName: string;
  /** Whether subject / movie poster refs are sent to the model */
  supportsRefs: boolean;
  hint?: string;
}

export const CAROUSEL_IMAGE_MODELS: CarouselImageModelDef[] = [
  {
    id: 'nano-banana-pro',
    replicateId: 'google/nano-banana-pro',
    name: 'Nano Banana Pro',
    shortName: 'Nano Banana',
    supportsRefs: true,
    hint: 'Best face lock with reference photos',
  },
  {
    id: 'gpt-image-2',
    replicateId: 'openai/gpt-image-2',
    name: 'GPT Image 2',
    shortName: 'GPT Image',
    supportsRefs: true,
  },
  {
    id: 'flux-2-max',
    replicateId: 'black-forest-labs/flux-2-max',
    name: 'FLUX.2 Max',
    shortName: 'FLUX Max',
    supportsRefs: true,
  },
  {
    id: 'seedream-5-lite',
    replicateId: 'bytedance/seedream-5-lite',
    name: 'Seedream 5 Lite',
    shortName: 'Seedream 5',
    supportsRefs: true,
  },
];

export const DEFAULT_CAROUSEL_IMAGE_MODEL_ID: CarouselImageModelId = 'nano-banana-pro';

export function getCarouselImageModel(
  id: string | null | undefined
): CarouselImageModelDef {
  return (
    CAROUSEL_IMAGE_MODELS.find((model) => model.id === id) ?? CAROUSEL_IMAGE_MODELS[0]
  );
}

export function isCarouselImageModelId(id: unknown): id is CarouselImageModelId {
  return (
    typeof id === 'string' && CAROUSEL_IMAGE_MODELS.some((model) => model.id === id)
  );
}

/** Map our 4:5 carousel frame to each model's allowed aspect_ratio enum. */
function aspectForModel(modelId: CarouselImageModelId, aspectRatio: string): string {
  const requested = aspectRatio || DEFAULT_ASPECT;

  switch (modelId) {
    case 'seedream-5-lite': {
      // Allowed: match_input_image, 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9
      const allowed = new Set([
        'match_input_image',
        '1:1',
        '4:3',
        '3:4',
        '16:9',
        '9:16',
        '3:2',
        '2:3',
        '21:9',
      ]);
      if (allowed.has(requested)) return requested;
      return '3:4'; // closest portrait to 4:5
    }
    case 'gpt-image-2': {
      // Common GPT Image ratios — 4:5 is not accepted
      const allowed = new Set(['1:1', '3:2', '2:3', '16:9', '9:16', 'auto']);
      if (allowed.has(requested)) return requested;
      return '2:3';
    }
    case 'flux-2-max':
    case 'nano-banana-pro':
    default:
      return requested;
  }
}

/** Seedream (and some others) reject prompts over 4000 chars. */
function clampPrompt(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;
  return `${prompt.slice(0, maxChars - 24).trimEnd()}\n\n[prompt truncated]`;
}

export interface BuildCarouselModelInputOptions {
  modelId: CarouselImageModelId;
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio?: string;
  resolution?: string;
}

/**
 * Build the Replicate `input` object for the selected carousel model.
 * Reference handling differs per model (image_input vs input_images).
 */
export function buildCarouselModelInput(
  options: BuildCarouselModelInputOptions
): Record<string, unknown> {
  const {
    modelId,
    referenceImageUrls,
    resolution = '2K',
  } = options;
  const aspectRatio = aspectForModel(modelId, options.aspectRatio || DEFAULT_ASPECT);
  const refs = referenceImageUrls.filter(Boolean);
  const prepared = prepareImageInputs(refs);

  switch (modelId) {
    case 'nano-banana-pro':
      return {
        prompt: options.prompt,
        resolution: resolution === '1K' || resolution === '4K' ? resolution : '2K',
        image_input: prepared,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        safety_filter_level: 'block_only_high',
        num_images: 1,
      };

    case 'gpt-image-2': {
      const input: Record<string, unknown> = {
        prompt: options.prompt,
        quality: resolution === '4K' || resolution === '3K' ? 'high' : 'auto',
        background: 'auto',
        moderation: 'auto',
        aspect_ratio: aspectRatio,
        number_of_images: 1,
        output_format: 'webp',
        output_compression: 90,
      };
      if (refs.length > 0) input.input_images = refs;
      return input;
    }

    case 'flux-2-max':
      return {
        prompt: options.prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution === '4K' ? '4 MP' : '2 MP',
        input_images: prepared.slice(0, 8),
        output_format: 'png',
        output_quality: 90,
        safety_tolerance: 2,
      };

    case 'seedream-5-lite':
      return {
        prompt: clampPrompt(options.prompt, 4000),
        size: resolution === '1K' ? '2K' : resolution === '4K' ? '3K' : '2K',
        aspect_ratio: aspectRatio,
        image_input: prepared.slice(0, 14),
        max_images: 1,
        output_format: 'png',
      };

    default:
      return {
        prompt: options.prompt,
        aspect_ratio: aspectRatio,
        image_input: prepared,
      };
  }
}
