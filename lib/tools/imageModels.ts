/**
 * Extensible image model registry — UI chip pickers read from this list.
 */

export type ImageModelId = 'nano-banana-2' | 'seedream-3';

export interface ImageModelDef {
  id: ImageModelId;
  /** Full display name */
  name: string;
  /** Short label for chip buttons */
  shortName: string;
  /** Accepts reference/inspiration images */
  supportsRefs: boolean;
}

export const IMAGE_MODELS: ImageModelDef[] = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    shortName: 'Nano Banana',
    supportsRefs: true,
  },
  {
    id: 'seedream-3',
    name: 'Seedream 3',
    shortName: 'Seedream 3',
    supportsRefs: false,
  },
];

export const DEFAULT_IMAGE_MODEL_ID: ImageModelId = 'nano-banana-2';

export function getImageModel(id: string | null | undefined): ImageModelDef {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];
}
