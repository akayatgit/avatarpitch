/**
 * Browser-only helpers for Carousel Maker.
 * Photos stay in the session as compressed data URLs — no storage backend.
 */

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read that photo'));
    };
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(dataUrl: string, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

/** Shrink a gallery photo so it can live in memory and travel to Replicate. */
export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.82
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return compressDataUrl(dataUrl, maxEdge, quality);
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
