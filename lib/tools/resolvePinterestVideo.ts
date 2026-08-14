/**
 * Resolve a pasted Pinterest pin URL (pinterest.com/pin/... or pin.it short link)
 * into a directly downloadable background asset for the Job Reel workflow.
 *
 * Video pins embed their renditions as JSON (`video_list`) in the page HTML —
 * we pick the best MP4 rendition. Pins without a video fall back to the
 * existing image resolver so a still can be used as the background instead.
 */

import { resolveInspirationImageUrl } from './resolveInspirationImage';

export interface ResolvedBackground {
  url: string;
  type: 'video' | 'image';
}

const PIN_PAGE_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

function unescapeJsonUrl(url: string): string {
  return url
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .trim();
}

/** Preference order for Pinterest MP4 renditions found in the page JSON. */
const RENDITION_PRIORITY = ['720p', '720w', 'expmp4', 'expanded', '480p', 'v_exp', 'mc'];

function rankVideoUrl(url: string): number {
  const lower = url.toLowerCase();
  const index = RENDITION_PRIORITY.findIndex((token) => lower.includes(token));
  return index === -1 ? RENDITION_PRIORITY.length : index;
}

/**
 * Collect every v.pinimg.com MP4 URL embedded in the pin page (video_list JSON,
 * og:video meta tags, …) and return the best-looking rendition.
 */
export function extractPinterestVideoUrl(html: string): string | null {
  const candidates = new Set<string>();

  // Any MP4 hosted on Pinterest's video CDN (v.pinimg.com, v1.pinimg.com, …),
  // in raw or JSON-escaped form (URL bodies may contain \u002F, \u0026 or \/ escapes)
  const urlChar = String.raw`(?:[^"'\s\\]|\\u002F|\\u0026|\\\/)`;
  const mp4Pattern = new RegExp(
    String.raw`https:(?:\\u002F\\u002F|\\\/\\\/|\/\/)v\d*\.pinimg\.com${urlChar}*?\.mp4${urlChar}*`,
    'gi'
  );
  for (const match of html.match(mp4Pattern) ?? []) {
    candidates.add(unescapeJsonUrl(match));
  }

  // og:video / og:video:url / twitter:player:stream meta tags
  const metaPatterns = [
    /property=["']?og:video(?::url|:secure_url)?["']?\s[^>]*content=["']([^"']+\.mp4[^"']*)["']/i,
    /content=["']([^"']+\.mp4[^"']*)["']\s[^>]*property=["']?og:video(?::url|:secure_url)?["']?/i,
  ];
  for (const re of metaPatterns) {
    const m = html.match(re);
    if (m?.[1]) candidates.add(unescapeJsonUrl(m[1]));
  }

  if (candidates.size === 0) return null;

  return Array.from(candidates).sort((a, b) => rankVideoUrl(a) - rankVideoUrl(b))[0];
}

function isPinterestUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host.includes('pinterest.') || host === 'pin.it' || host.endsWith('.pin.it');
  } catch {
    return false;
  }
}

function isDirectVideoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      /\.(mp4|mov|webm)(\?|$)/i.test(u.pathname) || /^v\d*\.pinimg\.com$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Resolve a pasted URL into a downloadable video (preferred) or image background.
 */
export async function resolvePinterestBackground(raw: string): Promise<ResolvedBackground> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Paste a Pinterest URL first');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('That does not look like a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must be http(s)');
  }

  if (isDirectVideoUrl(trimmed)) {
    return { url: trimmed, type: 'video' };
  }

  if (isPinterestUrl(trimmed)) {
    const response = await fetch(trimmed, {
      headers: PIN_PAGE_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(
        `Could not open that Pinterest URL (${response.status}). Try copying the pin link again.`
      );
    }

    const html = await response.text();
    const videoUrl = extractPinterestVideoUrl(html);
    if (videoUrl) {
      return { url: videoUrl, type: 'video' };
    }
  }

  // No video found — fall back to a still image background
  const imageUrl = await resolveInspirationImageUrl(trimmed);
  return { url: imageUrl, type: 'image' };
}
