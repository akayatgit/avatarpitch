import { NextRequest, NextResponse } from 'next/server';
import {
  extractMediaUrl,
  getReplicateClient,
  prepareImageInputs,
} from '@/lib/tools/replicateClient';
import { CAROUSEL_ASPECT_RATIO, composeFaceBlendPrompt } from '@/lib/carouselMaker';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const NANO_BANANA_PRO_MODEL = 'google/nano-banana-pro' as const;

async function runNanoBananaPro(options: {
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: string;
  resolution: string;
}): Promise<string> {
  const replicate = getReplicateClient();
  const output = await replicate.run(NANO_BANANA_PRO_MODEL, {
    input: {
      prompt: options.prompt,
      resolution: options.resolution,
      image_input: prepareImageInputs(options.referenceImageUrls),
      aspect_ratio: options.aspectRatio,
      output_format: 'png',
      safety_filter_level: 'block_only_high',
      num_images: 1,
    },
  });

  const imageUrl = extractMediaUrl(output);
  if (!imageUrl) {
    throw new Error('Nano Banana Pro returned no image — try again');
  }
  return imageUrl;
}

/**
 * Two-pass carousel slide generation:
 * 1) Compose the poster (composition + text + cast).
 * 2) Face integration — restyle hair/beard from the movie poster, relight the
 *    face to match the scene, fix proportions. One-pass paste is not enough.
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

    const subjectImageUrls: string[] = Array.isArray(body.subjectImageUrls)
      ? body.subjectImageUrls.filter(
          (url: unknown): url is string => typeof url === 'string' && Boolean(url.trim())
        )
      : [];

    const movieRefImageUrls: string[] = Array.isArray(body.movieRefImageUrls)
      ? body.movieRefImageUrls.filter(
          (url: unknown): url is string => typeof url === 'string' && Boolean(url.trim())
        )
      : [];

    const subjectDescription =
      typeof body.subjectDescription === 'string' ? body.subjectDescription : '';
    const themeNote = typeof body.themeNote === 'string' ? body.themeNote : '';

    const aspectRatio =
      typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
        ? body.aspectRatio.trim()
        : CAROUSEL_ASPECT_RATIO;

    const resolution =
      body.resolution === '1K' || body.resolution === '4K' ? body.resolution : '2K';

    // Pass 1 — compose the poster
    const draftUrl = await runNanoBananaPro({
      prompt,
      referenceImageUrls,
      aspectRatio,
      resolution,
    });

    // Pass 2 — face integration (skip only if there is no subject to blend)
    if (subjectImageUrls.length === 0) {
      return NextResponse.json({ success: true, imageUrl: draftUrl, draftImageUrl: draftUrl });
    }

    const { prompt: blendPrompt } = composeFaceBlendPrompt({
      subjectDescription,
      subjectCount: subjectImageUrls.length,
      movieCount: movieRefImageUrls.length,
      themeNote,
    });

    // Draft first (edit target), then subject (identity), then movie poster (style)
    const blendRefs = [draftUrl, ...subjectImageUrls, ...movieRefImageUrls];

    try {
      const blendedUrl = await runNanoBananaPro({
        prompt: blendPrompt,
        referenceImageUrls: blendRefs,
        aspectRatio,
        resolution,
      });
      return NextResponse.json({
        success: true,
        imageUrl: blendedUrl,
        draftImageUrl: draftUrl,
      });
    } catch (blendError) {
      // Composition succeeded — return the draft rather than failing the whole run
      console.error('Face blend pass failed, returning draft:', blendError);
      return NextResponse.json({
        success: true,
        imageUrl: draftUrl,
        draftImageUrl: draftUrl,
        blendWarning:
          blendError instanceof Error ? blendError.message : 'Face blend pass failed',
      });
    }
  } catch (error) {
    console.error('Carousel slide generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate slide' },
      { status: 500 }
    );
  }
}
