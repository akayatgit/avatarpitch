import { NextRequest, NextResponse } from 'next/server';
import {
  generateImage,
  type ImageSize,
  type ImageStyleMode,
} from '@/lib/tools/imageGeneration';
import { generateNanoBananaImage } from '@/lib/tools/nanoBananaImage';
import { generateSeedreamImage } from '@/lib/tools/seedreamImage';
import { persistRemoteFileToStorage } from '@/lib/storage';

/** Replicate output URLs expire — re-host in Supabase Storage so saved projects stay valid. */
async function persistImages(images: string[]): Promise<string[]> {
  return Promise.all(
    images.map((url) =>
      url.startsWith('http')
        ? persistRemoteFileToStorage(url, {
            folder: 'drone-shot/images',
            fileName: `image-${Date.now()}.jpg`,
            contentType: 'image/jpeg',
          })
        : Promise.resolve(url)
    )
  );
}

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Shared image tool wrapper.
 * - model: 'gpt-image-2' (default) for HQ refine / workflow stills
 * - model: 'nano-banana-2' for suggestion drafts (google_search + image_search on)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenePrompt,
      referenceImageUrls,
      numImages,
      size,
      mode,
      model,
      imageSearch,
      googleSearch,
      resolution,
    } = body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!scenePrompt || typeof scenePrompt !== 'string' || scenePrompt.trim().length === 0) {
      return NextResponse.json({ error: 'Scene prompt is required' }, { status: 400 });
    }

    const imageUrls = Array.isArray(referenceImageUrls)
      ? referenceImageUrls.filter(Boolean)
      : referenceImageUrls
        ? [referenceImageUrls]
        : [];

    if (model === 'nano-banana-2') {
      const nanoResolution =
        resolution === '1K' || resolution === '4K' || resolution === '2K'
          ? resolution
          : size === '3K' || size === '4K'
            ? '4K'
            : '2K';

      const images = await generateNanoBananaImage({
        prompt: scenePrompt,
        referenceImageUrls: imageUrls,
        resolution: nanoResolution,
        aspectRatio: '9:16',
        imageSearch: imageSearch !== false,
        googleSearch: googleSearch !== false,
        outputFormat: 'jpg',
      });

      return NextResponse.json({
        success: true,
        images: await persistImages(images),
        model: 'nano-banana-2',
      });
    }

    if (model === 'seedream-3') {
      const images = await generateSeedreamImage({
        prompt: scenePrompt,
        aspectRatio: '9:16',
        outputFormat: 'jpg',
      });
      return NextResponse.json({ success: true, images: await persistImages(images), model: 'seedream-3' });
    }

    const styleMode: ImageStyleMode =
      mode === 'aerial' || mode === 'scene' || mode === 'none' ? mode : 'aerial';

    const resolvedSize: ImageSize =
      size === '480p' || size === 'draft' || size === 'low'
        ? '480p'
        : size === '720p'
          ? '720p'
          : size === '3K'
            ? '3K'
            : '2K';

    const images = await generateImage({
      prompt: scenePrompt,
      referenceImageUrls: imageUrls,
      size: resolvedSize,
      numImages: Math.min(Math.max(Number(numImages) || 1, 1), 5),
      mode: styleMode,
    });

    return NextResponse.json({ success: true, images: await persistImages(images), model: 'gpt-image-2' });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
