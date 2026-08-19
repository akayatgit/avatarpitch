import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function isReplicateImageUrl(src: string | null): src is string {
  if (!src) return false;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'replicate.delivery' || host.endsWith('.replicate.delivery');
  } catch {
    return false;
  }
}

/**
 * Same-origin download proxy for freshly generated slides.
 *
 * The PNG lives on Replicate's CDN — a different origin, so the anchor
 * `download` attribute is ignored and mobile browsers open the image in a
 * tab. Streaming through here with `Content-Disposition: attachment` gives
 * iOS/Android the real save prompt.
 */
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');
  if (!isReplicateImageUrl(src)) {
    return NextResponse.json({ error: 'Not a generated image URL' }, { status: 400 });
  }

  const rawName = request.nextUrl.searchParams.get('name') ?? '';
  const filename =
    rawName
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'carousel-slide.png';

  let upstream: Response;
  try {
    upstream = await fetch(src, { cache: 'no-store' });
  } catch {
    return NextResponse.json({ error: 'The image is no longer available — generate again' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `The image is no longer available (${upstream.status}) — generate again` },
      { status: 404 }
    );
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'image/png',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  const contentLength = upstream.headers.get('Content-Length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
