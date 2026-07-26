import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HOST_SUFFIXES = [
  'replicate.delivery',
  'replicate.com',
  'pbxt.replicate.delivery',
  // Pinterest / inspiration thumbnails
  'pinimg.com',
  'pinterest.com',
  'pinterest.co.uk',
  'pinterest.ca',
  'pinterest.de',
  'pinterest.fr',
  'pin.it',
];

function isAllowedImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

/**
 * Proxy Replicate (and similar) image URLs through our server so the browser
 * can display them even when corporate TLS/proxy blocks replicate.delivery.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'URL host not allowed' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'image/*,*/*' },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
