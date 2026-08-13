import sharp from 'sharp';

/** Seedance is sensitive to large / non-JPEG refs — keep files small JPG. */
export const SEEDANCE_MAX_EDGE = 1280;
export const SEEDANCE_TARGET_MAX_BYTES = 900_000; // ~900KB
export const SEEDANCE_JPEG_QUALITY_START = 82;
export const SEEDANCE_JPEG_QUALITY_MIN = 55;

async function loadImageBuffer(image: string): Promise<Buffer> {
  const trimmed = image.trim();
  if (!trimmed) {
    throw new Error('Empty reference image for Seedance');
  }

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL for Seedance reference image');
    }
    return Buffer.from(match[2], 'base64');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Failed to fetch Seedance reference image (${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Seedance reference image must be a data URL or http(s) URL');
}

/**
 * Resize + re-encode as compressed JPEG.
 * Seedance E005 "sensitive" failures are often oversized PNG/WebP refs — not the prompt.
 */
export async function compressImageForSeedance(image: string): Promise<string> {
  const input = await loadImageBuffer(image);

  let quality = SEEDANCE_JPEG_QUALITY_START;
  let jpeg = await sharp(input)
    .rotate()
    .resize({
      width: SEEDANCE_MAX_EDGE,
      height: SEEDANCE_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();

  while (jpeg.length > SEEDANCE_TARGET_MAX_BYTES && quality > SEEDANCE_JPEG_QUALITY_MIN) {
    quality -= 8;
    jpeg = await sharp(input)
      .rotate()
      .resize({
        width: SEEDANCE_MAX_EDGE,
        height: SEEDANCE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
  }

  // Last resort: shrink edges further
  if (jpeg.length > SEEDANCE_TARGET_MAX_BYTES) {
    jpeg = await sharp(input)
      .rotate()
      .resize({
        width: 720,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: SEEDANCE_JPEG_QUALITY_MIN, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
  }

  console.log(
    `Seedance ref compressed to JPEG ${jpeg.length} bytes (q≈${quality})`
  );

  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** Compress every Seedance reference to a small JPEG data URI. */
export async function prepareSeedanceReferenceImages(
  referenceImages: string[]
): Promise<string[]> {
  const urls = referenceImages.filter(Boolean).slice(0, 9);
  return Promise.all(urls.map((url) => compressImageForSeedance(url)));
}
