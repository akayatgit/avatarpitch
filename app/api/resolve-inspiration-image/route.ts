import { NextRequest, NextResponse } from 'next/server';
import { resolveInspirationImageUrl } from '@/lib/tools/resolveInspirationImage';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/** Resolve a Pinterest pin page or image URL into a direct image URL for thumbnails. */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    const imageUrl = await resolveInspirationImageUrl(url);
    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve image URL' },
      { status: 400 }
    );
  }
}
