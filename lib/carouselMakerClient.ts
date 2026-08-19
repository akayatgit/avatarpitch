/**
 * Browser-only helpers for Carousel Maker.
 * Photos stay in the session as compressed data URLs — no storage backend.
 */

/** Shrink a gallery photo so it can live in memory and travel to Replicate. */
export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not read that photo');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Same-origin download: data URLs save directly; remote images go through the proxy. */
export function downloadImage(imageUrl: string, filename: string) {
  const href = imageUrl.startsWith('data:')
    ? imageUrl
    : `/api/carousel-maker/download?src=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(filename)}`;

  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
