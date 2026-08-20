/**
 * Image models available in Carousel Maker.
 * Each entry knows its Replicate id and how to build the prediction input.
 */

import { prepareImageInputs } from '@/lib/tools/replicateClient';

/** Instagram portrait — matches the reference posters. */
const DEFAULT_ASPECT = '4:5' as const;

export type CarouselImageModelId =
  | 'nano-banana-pro'
  | 'p-image-ideogram'
  | 'gpt-image-2'
  | 'flux-2-max'
  | 'seedream-5-lite'
  | 'ideogram-v3-turbo';

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
    id: 'p-image-ideogram',
    replicateId: 'prunaai/p-image-ideogram',
    name: 'P-Image Ideogram',
    shortName: 'P-Ideogram',
    supportsRefs: false,
    hint: 'Strong typography — no reference images',
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
  {
    id: 'ideogram-v3-turbo',
    replicateId: 'ideogram-ai/ideogram-v3-turbo',
    name: 'Ideogram v3 Turbo',
    shortName: 'Ideogram',
    supportsRefs: true,
    hint: 'Uses refs as style references',
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

/** Models that don't advertise 4:5 get the closest supported ratio. */
function aspectForModel(modelId: CarouselImageModelId, aspectRatio: string): string {
  if (aspectRatio && aspectRatio !== DEFAULT_ASPECT) return aspectRatio;
  if (modelId === 'p-image-ideogram') return '3:4';
  return aspectRatio || DEFAULT_ASPECT;
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
 * Reference handling differs per model (image_input vs input_images vs none).
 */
export function buildCarouselModelInput(
  options: BuildCarouselModelInputOptions
): Record<string, unknown> {
  const {
    modelId,
    prompt,
    referenceImageUrls,
    resolution = '2K',
  } = options;
  const aspectRatio = aspectForModel(modelId, options.aspectRatio || DEFAULT_ASPECT);
  const refs = referenceImageUrls.filter(Boolean);
  const prepared = prepareImageInputs(refs);

  switch (modelId) {
    case 'nano-banana-pro':
      return {
        prompt,
        resolution: resolution === '1K' || resolution === '4K' ? resolution : '2K',
        image_input: prepared,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        safety_filter_level: 'block_only_high',
        num_images: 1,
      };

    case 'p-image-ideogram':
      // Prompt-only — no reference image slot on this model
      return {
        prompt,
        thinking: 'high',
        image_size: resolution === '1K' ? '1K' : '2K',
        aspect_ratio: aspectRatio,
        prompt_upsampling: false,
        output_format: 'png',
        output_quality: 90,
      };

    case 'gpt-image-2': {
      // Schema wants string[] URLs / data URIs (not Buffers)
      const input: Record<string, unknown> = {
        prompt,
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
        prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution === '4K' ? '4 MP' : '2 MP',
        input_images: prepared.slice(0, 8),
        output_format: 'png',
        output_quality: 90,
        safety_tolerance: 2,
      };

    case 'seedream-5-lite':
      return {
        prompt,
        size: resolution === '1K' ? '2K' : resolution === '4K' ? '3K' : '2K',
        aspect_ratio: aspectRatio,
        image_input: prepared.slice(0, 14),
        max_images: 1,
        output_format: 'png',
      };

    case 'ideogram-v3-turbo': {
      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspectRatio === '4:5' ? '3:4' : aspectRatio,
        magic_prompt_option: 'Off',
        style_type: 'Realistic',
      };
      if (refs.length > 0) {
        // Ideogram takes style refs — still useful for poster mood + subject look
        input.style_reference_images = prepared;
      }
      return input;
    }

    default:
      return {
        prompt,
        aspect_ratio: aspectRatio,
        image_input: prepared,
      };
  }
}
