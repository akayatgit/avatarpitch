import { NextRequest, NextResponse } from 'next/server';
import { generateWorkflowVideo } from '@/lib/tools/generateWorkflowVideo';
import { persistRemoteFileToStorage } from '@/lib/storage';
import {
  DEFAULT_VIDEO_MODEL_ID,
  isSensitiveVideoError,
  isValidVideoModelId,
  SENSITIVE_FALLBACK_MODEL_ID,
} from '@/lib/tools/videoModels';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Shared video tool wrapper — model selected via `model` (seedance-2 | grok-imagine-1.5).
 * Accepts referenceImages[]; legacy `annotatedImage` is a single-ref alias.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration, resolution, aspectRatio, model } = body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const referenceImages: string[] = Array.isArray(body.referenceImages)
      ? body.referenceImages.filter((u: unknown) => typeof u === 'string' && u.length > 0)
      : typeof body.annotatedImage === 'string'
        ? [body.annotatedImage]
        : [];

    if (referenceImages.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image is required' },
        { status: 400 }
      );
    }

    const modelId = isValidVideoModelId(model) ? model : DEFAULT_VIDEO_MODEL_ID;

    const { videoUrl, modelId: usedModel } = await generateWorkflowVideo({
      model: modelId,
      prompt,
      referenceImages,
      duration: typeof duration === 'number' ? duration : 12,
      resolution: resolution === '480p' ? '480p' : '720p',
      aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : '9:16',
      generateAudio: true,
    });

    // Replicate output URLs expire — re-host in Supabase Storage so saved projects stay valid.
    const durableVideoUrl = videoUrl.startsWith('http')
      ? await persistRemoteFileToStorage(videoUrl, {
          folder: 'drone-shot/videos',
          fileName: `drone-shot-${Date.now()}.mp4`,
          contentType: 'video/mp4',
        })
      : videoUrl;

    return NextResponse.json({ success: true, videoUrl: durableVideoUrl, model: usedModel });
  } catch (error) {
    console.error('Video generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate video';
    const sensitive = isSensitiveVideoError(message);
    return NextResponse.json(
      {
        error: message,
        code: sensitive ? 'SENSITIVE_CONTENT' : 'VIDEO_GENERATION_FAILED',
        suggestedModel: sensitive ? SENSITIVE_FALLBACK_MODEL_ID : undefined,
      },
      { status: 500 }
    );
  }
}
