/**
 * Compatibility re-exports — prefer @/lib/tools/imageGeneration in new code.
 */
export {
  IMAGE_MODEL_ID,
  IMAGE_ASPECT_RATIO,
  buildGptImage2Input,
  processImageOutput,
  normalizeImageUrl,
  type ImageSize,
  type GenerateImageOptions as BuildImageInputOptions,
} from './tools/imageGeneration';

export { prepareImageInputs } from './tools/replicateClient';
export { toDisplayImageUrl } from './imageDisplay';
