import {
  extractMediaUrl,
  getReplicateClient,
  prepareImageInputs,
} from './replicateClient';

/**
 * Upscale-only enhancement (Recraft Crisp Upscale) — sharpens and increases
 * resolution without changing the content of the photo. Used by the Drone Shot
 * studio so low-res Pinterest pins hold up as video reference frames.
 */
export const UPSCALE_MODEL_ID = 'recraft-ai/recraft-crisp-upscale' as const;

export async function upscaleImage(imageUrl: string): Promise<string> {
  const replicate = getReplicateClient();
  const [image] = prepareImageInputs([imageUrl]);
  if (!image) {
    throw new Error('An image URL is required to upscale');
  }
  const output = await replicate.run(UPSCALE_MODEL_ID, { input: { image } });
  const url = extractMediaUrl(output);
  if (!url) {
    throw new Error('Upscaler returned no image');
  }
  return url;
}
