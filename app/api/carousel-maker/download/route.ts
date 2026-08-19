import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function isSupabaseStorageUrl(src: string | null): src is string {
  if (!src) return false;
  const base =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  if (!base) return false;
  try {
    return new URL(src).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/**
 * Same-origin download proxy for generated slides.
 *
 * The PNGs live in Supabase Storage — a different origin, so the anchor
 * `download` attribute is ignored and mobile browsers open the image in a
 * tab. Streaming through here with `Content-Disposition: attachment` gives
 * iOS/Android the real save prompt.
 */
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');
  if (!isSupabaseStorageUrl(src)) {
    return NextResponse.json({ error: 'Not a storage URL' }, { status: 400 });
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
    return NextResponse.json({ error: 'Storage is unreachable right now' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Image not found (${upstream.status})` }, { status: 404 });
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
