/**
 * Extensible video model registry for workflows.
 * Add new Replicate models here — UI dropdown reads from this list.
 */

export type VideoModelId = 'seedance-2' | 'grok-imagine-1.5';

export interface VideoModelDef {
  id: VideoModelId;
  name: string;
  description: string;
  /** Replicate model slug */
  replicateModel: `${string}/${string}`;
  /**
   * How reference images are sent:
   * - reference_images: Seedance-style multi-ref
   * - image: single first-frame (Grok Imagine)
   */
  imageMode: 'reference_images' | 'image';
}

export const VIDEO_MODELS: VideoModelDef[] = [
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    description: 'Multi-reference path tracing (default)',
    replicateModel: 'bytedance/seedance-2.0',
    imageMode: 'reference_images',
  },
  {
    id: 'grok-imagine-1.5',
    name: 'Grok Imagine 1.5',
    description: 'Image-to-video — use when Seedance flags sensitive',
    replicateModel: 'xai/grok-imagine-video-1.5',
    imageMode: 'image',
  },
];

export const DEFAULT_VIDEO_MODEL_ID: VideoModelId = 'seedance-2';

export function getVideoModel(id: string | null | undefined): VideoModelDef {
  return VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
}

export function isValidVideoModelId(id: unknown): id is VideoModelId {
  return typeof id === 'string' && VIDEO_MODELS.some((m) => m.id === id);
}

/** Detect Seedance / Replicate sensitive-content failures (E005). */
export function isSensitiveVideoError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('flagged as sensitive') ||
    m.includes('e005') ||
    (m.includes('sensitive') && (m.includes('modelerror') || m.includes('prediction failed')))
  );
}

/** Prefer Grok when Seedance hits a safety block. */
export const SENSITIVE_FALLBACK_MODEL_ID: VideoModelId = 'grok-imagine-1.5';
