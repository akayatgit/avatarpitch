import { NextRequest, NextResponse } from 'next/server';
import { extractMediaUrl, getReplicateClient } from '@/lib/tools/replicateClient';
import { CAROUSEL_ASPECT_RATIO } from '@/lib/carouselMaker';
import {
  buildCarouselModelInput,
  getCarouselImageModel,
  isCarouselImageModelId,
  DEFAULT_CAROUSEL_IMAGE_MODEL_ID,
} from '@/lib/carouselModels';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Generate one carousel slide with the selected image model.
 * Default: Nano Banana Pro. Client sends the composed prompt + ordered refs
 * (subject → movie poster → extra).
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

    const modelId = isCarouselImageModelId(body.model)
      ? body.model
      : DEFAULT_CAROUSEL_IMAGE_MODEL_ID;
    const model = getCarouselImageModel(modelId);

    const aspectRatio =
      typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
        ? body.aspectRatio.trim()
        : CAROUSEL_ASPECT_RATIO;

    const resolution =
      body.resolution === '1K' || body.resolution === '4K' ? body.resolution : '2K';

    const input = buildCarouselModelInput({
      modelId,
      prompt,
      referenceImageUrls: model.supportsRefs ? referenceImageUrls : [],
      aspectRatio,
      resolution,
    });

    const replicate = getReplicateClient();
    const output = await replicate.run(model.replicateId as `${string}/${string}`, { input });

    const imageUrl = extractMediaUrl(output);
    if (!imageUrl) {
      return NextResponse.json(
        { error: `${model.name} returned no image — try again` },
        { status: 502 }
      );
    }

    // Instant generate + download — no storage backend.
    return NextResponse.json({ success: true, imageUrl, model: modelId });
  } catch (error) {
    console.error('Carousel slide generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate slide' },
      { status: 500 }
    );
  }
}
