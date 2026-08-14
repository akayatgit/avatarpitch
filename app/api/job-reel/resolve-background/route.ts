import { NextRequest, NextResponse } from 'next/server';
import { resolvePinterestBackground } from '@/lib/tools/resolvePinterestVideo';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MAX_BACKGROUND_BYTES = 80 * 1024 * 1024;

const DOWNLOAD_HEADERS = {
  Accept: '*/*',
  Referer: 'https://www.pinterest.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Paste a Pinterest URL first' }, { status: 400 });
    }

    const resolved = await resolvePinterestBackground(url);

    // Re-host on Supabase Storage: Pinterest CDN links can expire and block CORS
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
    const storedUrl = await uploadPublicFile({
      path: buildUploadPath('job-reel/backgrounds', `background.${extension}`),
      body: Buffer.from(arrayBuffer),
      contentType,
    });

    return NextResponse.json({
      success: true,
      backgroundUrl: storedUrl,
      backgroundType: resolved.type,
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
