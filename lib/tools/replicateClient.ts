import Replicate from 'replicate';

/** Shared Replicate client — workflows never construct their own. */
export function getReplicateClient(): Replicate {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    useFileOutput: false,
  });
}

/** Coerce Replicate FileOutput / URL / string into a plain media URL. */
export function extractMediaUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === 'string') {
    const trimmed = output.trim();
    if (
      trimmed.startsWith('https:') ||
      trimmed.startsWith('http:') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed;
    }
    return null;
  }
  if (output instanceof URL) return output.href;
  if (Array.isArray(output) && output.length > 0) {
    return extractMediaUrl(output[0]);
  }
  if (typeof output === 'object') {
    const obj = output as { url?: unknown; href?: unknown; toString?: () => string };
    if (typeof obj.url === 'function') {
      return extractMediaUrl((obj.url as () => unknown)());
    }
    if (typeof obj.url === 'string' || obj.url instanceof URL) {
      return extractMediaUrl(obj.url);
    }
    if (typeof obj.href === 'string') return extractMediaUrl(obj.href);
    if (typeof obj.toString === 'function') {
      const asString = obj.toString();
      if (asString && asString !== '[object Object]' && asString !== '[object Promise]') {
        return extractMediaUrl(asString);
      }
    }
  }
  return null;
}

/**
 * Convert data URLs to Buffers so the Replicate SDK can upload them.
 * HTTP(S) URLs pass through unchanged.
 */
export function prepareImageInputs(urls: string[]): Array<string | Buffer> {
  return urls.filter(Boolean).map((url) => {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URL for reference image');
      }
      return Buffer.from(match[2], 'base64');
    }
    return url;
  });
}

function sniffImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function normalizeGrokMime(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/webp') return 'image/webp';
  return null;
}

function urlLooksLikeGrokFormat(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpe?g|png|webp)$/.test(path);
  } catch {
    return /\.(jpe?g|png|webp)(\?|$)/i.test(url);
  }
}

/**
 * Grok Imagine requires .jpeg/.jpg/.png/.webp.
 * Bare Buffers upload without an extension and fail — always send a typed data URI
 * (or an https URL that already ends with a supported extension).
 */
export async function prepareGrokImageInput(image: string): Promise<string> {
  const trimmed = image.trim();
  if (!trimmed) {
    throw new Error('A starting image is required for Grok Imagine');
  }

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL for Grok Imagine image');
    }
    const mime = normalizeGrokMime(match[1]);
    if (mime) {
      // Keep explicit mime so Replicate/Grok can detect jpeg|png|webp
      return `data:${mime};base64,${match[2]}`;
    }
    const buf = Buffer.from(match[2], 'base64');
    const sniffed = sniffImageMime(buf);
    if (!sniffed) {
      throw new Error(
        'Grok Imagine only accepts .jpeg, .jpg, .png, or .webp images'
      );
    }
    return `data:${sniffed};base64,${buf.toString('base64')}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (urlLooksLikeGrokFormat(trimmed)) {
      return trimmed;
    }
    // Replicate CDN URLs often have no extension — fetch and re-emit as data URI
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Failed to fetch image for Grok Imagine (${response.status})`);
    }
    const contentType = normalizeGrokMime(response.headers.get('content-type') || '');
    const arrayBuf = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const mime = contentType || sniffImageMime(buf);
    if (!mime) {
      throw new Error(
        'Grok Imagine only accepts .jpeg, .jpg, .png, or .webp images'
      );
    }
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  throw new Error('Grok Imagine image must be a data URL or http(s) image URL');
}
