/**
 * Normalize a pasted inspiration URL (Pinterest pin page or direct pinimg / image URL)
 * into a fetchable image URL for thumbnails + vision.
 */

function extractOgImage(html: string): string | null {
  const patterns = [
    /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:image["']/i,
    /name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function isLikelyDirectImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(path)) return true;
    const host = u.hostname.toLowerCase();
    if (host.includes('pinimg.com')) return true;
    if (host.includes('i.pinimg.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function resolveInspirationImageUrl(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Image URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must be http(s)');
  }

  if (isLikelyDirectImageUrl(trimmed)) {
    return trimmed;
  }

  const host = parsed.hostname.toLowerCase();
  const isPinterestPage =
    host.includes('pinterest.') || host === 'pin.it' || host.endsWith('.pin.it');

  if (!isPinterestPage) {
    // Assume it's still an image CDN without a file extension
    return trimmed;
  }

  const response = await fetch(trimmed, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Could not open Pinterest URL (${response.status}). Paste a direct pinimg.com image link instead.`);
  }

  const html = await response.text();
  const og = extractOgImage(html);
  if (!og) {
    throw new Error(
      'Could not extract an image from that Pinterest page. Open the pin → right-click the image → copy image address (pinimg.com) and paste that.'
    );
  }
  return og;
}
