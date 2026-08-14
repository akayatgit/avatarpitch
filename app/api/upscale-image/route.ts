import { NextRequest, NextResponse } from 'next/server';
import { persistRemoteFileToStorage } from '@/lib/storage';
import { upscaleImage } from '@/lib/tools/upscaleImage';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Upscale-only photo enhancement — no content change.
 * Body: { imageUrl } → { imageUrl } (re-hosted in Supabase Storage so it never expires).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const upscaled = await upscaleImage(imageUrl);
    const durable = upscaled.startsWith('http')
      ? await persistRemoteFileToStorage(upscaled, {
          folder: 'drone-shot/enhanced',
          fileName: `enhanced-${Date.now()}.jpg`,
          contentType: 'image/jpeg',
        })
      : upscaled;

    return NextResponse.json({ success: true, imageUrl: durable });
  } catch (error) {
    console.error('Upscale image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enhance the photo' },
      { status: 500 }
    );
  }
}
