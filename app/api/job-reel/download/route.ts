import { NextRequest, NextResponse } from 'next/server';
import { isTowerAssetHttpUrl } from '@/lib/towerStorage';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Same-origin download proxy for finished reels.
 *
 * The MP4s live on the ThinkPad (tower asset API) — a different origin, so the
 * anchor `download` attribute is ignored and iPhone browsers just play the
 * video in a new tab. Streaming it through here with
 * `Content-Disposition: attachment` makes iOS Safari/Chrome show the real
 * download prompt and save the file.
 */
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');
  if (!isTowerAssetHttpUrl(src)) {
    return NextResponse.json({ error: 'Not a tower asset URL' }, { status: 400 });
  }

  const rawName = request.nextUrl.searchParams.get('name') ?? '';
  const filename =
    rawName
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'job-reel.mp4';

  let upstream: Response;
  try {
    upstream = await fetch(src, { cache: 'no-store' });
  } catch {
    return NextResponse.json({ error: 'Watch Tower is unreachable right now' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `The video is no longer on the tower (${upstream.status}) — re-render the reel` },
      { status: 404 }
    );
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'video/mp4',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  const contentLength = upstream.headers.get('Content-Length');
  if (contentLength) headers.set('Content-Length', contentLength);

  // Stream straight through — streamed responses aren't subject to the
  // serverless buffered-response size cap, so full-size reels are fine
  return new Response(upstream.body, { status: 200, headers });
}
