/**
 * Normalize a pasted inspiration URL (Pinterest pin page or direct pinimg / image URL)
 * into a fetchable image URL for thumbnails + vision.
 */

function extractOgImage(html: string): string | null {
  const patterns = [
    // Standard order: property then content (with or without quotes on attr name)
    /property=["']?og:image["']?\s[^>]*content=["']([^"']+)["']/i,
    /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    // Reversed order
    /content=["']([^"']+)["']\s[^>]*property=["']?og:image["']/i,
    /content=["']([^"']+)["']\s+property=["']og:image["']/i,
    // secure_url variant
    /property=["']?og:image:secure_url["']?\s[^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s[^>]*property=["']?og:image:secure_url["']/i,
    // Twitter card
    /name=["']?twitter:image["']?\s[^>]*content=["']([^"']+)["']/i,
    /name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Pinterest embeds pin data as JSON inside script tags.
 * Extract the highest-quality image URL from that JSON blob.
 */
function extractPinterestJsonImage(html: string): string | null {
  // Pinterest typically puts image URLs inside JSON that includes "orig" resolution
  const jsonPatterns = [
    // "orig":{"url":"https://i.pinimg.com/..."}
    /"orig"\s*:\s*\{\s*"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/i,
    // "images":{"orig":{"url":"..."}}
    /"images"\s*:\s*\{[^}]{0,200}"orig"\s*:\s*\{[^}]{0,100}"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/i,
    // Fallback: any pinimg.com URL that looks like a full-size image
    /"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/i,
    /"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/\d+x\/[^"]+)"/i,
  ];
  for (const re of jsonPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      // Unescape JSON unicode escapes (e.g. \u002F → /)
      return m[1].replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').trim();
    }
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
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Could not open Pinterest URL (${response.status}). Paste a direct pinimg.com image link instead.`);
  }

  const html = await response.text();

  // Try og:image / twitter:image first, then fall back to Pinterest's embedded JSON
  const imageUrl = extractOgImage(html) ?? extractPinterestJsonImage(html);
  if (!imageUrl) {
    throw new Error(
      'Could not extract an image from that Pinterest page. Open the pin → right-click the image → copy image address (pinimg.com) and paste that.'
    );
  }
  return imageUrl;
}
