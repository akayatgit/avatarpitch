import { NextRequest, NextResponse } from 'next/server';
import { resolvePinterestBackground } from '@/lib/tools/resolvePinterestVideo';
import { putTowerAsset } from '@/lib/towerStorage';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_BACKGROUND_BYTES = 80 * 1024 * 1024;

const DOWNLOAD_HEADERS = {
  Accept: '*/*',
  Referer: 'https://www.pinterest.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

/**
 * Resolve a Pinterest pin and re-host the media on the ThinkPad through the
 * tower asset API (Ashok's ruling — CDN links expire, ThinkPad copies don't).
 * Falls back to the direct CDN URL while the tower storage endpoint isn't
 * enabled yet, so the workflow never blocks on the tower.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Paste a Pinterest URL first' }, { status: 400 });
    }

    const resolved = await resolvePinterestBackground(url);

    const response = await fetch(resolved.url, { headers: DOWNLOAD_HEADERS });
    if (!response.ok) {
      throw new Error(`Could not download the background (${response.status}). Try another pin.`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BACKGROUND_BYTES) {
      throw new Error('That background is too large (over 80 MB). Try a shorter pin video.');
    }
    if (arrayBuffer.byteLength < 1024) {
      throw new Error('Pinterest returned an empty file. Try copying the pin link again.');
    }

    const isVideo = resolved.type === 'video';
    const contentType =
      response.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
    const extension = isVideo ? 'mp4' : 'jpg';
    const key = `job-reel/backgrounds/bg-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const storedUrl = await putTowerAsset(key, Buffer.from(arrayBuffer), contentType);

    return NextResponse.json({
      success: true,
      backgroundUrl: storedUrl ?? resolved.url,
      backgroundType: resolved.type,
      storedOnTower: Boolean(storedUrl),
    });
  } catch (error) {
    console.error('Job reel resolve-background error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not resolve a background from that URL',
      },
      { status: 500 }
    );
  }
}
