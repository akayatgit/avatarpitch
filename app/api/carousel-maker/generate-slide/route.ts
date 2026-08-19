import { NextRequest, NextResponse } from 'next/server';
import {
  extractMediaUrl,
  getReplicateClient,
  prepareImageInputs,
} from '@/lib/tools/replicateClient';
import { persistRemoteFileToStorage } from '@/lib/storage';
import { CAROUSEL_ASPECT_RATIO } from '@/lib/carouselMaker';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const NANO_BANANA_PRO_MODEL = 'google/nano-banana-pro' as const;

/**
 * Generate one carousel slide with Nano Banana Pro.
 * The client composes the prompt (style + role + text + theme) and sends the
 * ordered reference images: subject photos, movie poster refs, extra refs.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const referenceImageUrls: string[] = Array.isArray(body.referenceImageUrls)
      ? body.referenceImageUrls.filter(
          (url: unknown): url is string => typeof url === 'string' && Boolean(url.trim())
        )
      : [];

    const aspectRatio =
      typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
        ? body.aspectRatio.trim()
        : CAROUSEL_ASPECT_RATIO;

    const resolution =
      body.resolution === '1K' || body.resolution === '4K' ? body.resolution : '2K';

    const replicate = getReplicateClient();
    const output = await replicate.run(NANO_BANANA_PRO_MODEL, {
      input: {
        prompt,
        resolution,
        image_input: prepareImageInputs(referenceImageUrls),
        aspect_ratio: aspectRatio,
        output_format: 'png',
        safety_filter_level: 'block_only_high',
        num_images: 1,
      },
    });

    const imageUrl = extractMediaUrl(output);
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Nano Banana Pro returned no image — try again' },
        { status: 502 }
      );
    }

    // Replicate URLs expire — re-host so the draft survives.
    const persistedUrl = await persistRemoteFileToStorage(imageUrl, {
      folder: 'carousel-maker/images',
      fileName: `slide-${Date.now()}.png`,
      contentType: 'image/png',
    });

    return NextResponse.json({ success: true, imageUrl: persistedUrl });
  } catch (error) {
    console.error('Carousel slide generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate slide' },
      { status: 500 }
    );
  }
}
