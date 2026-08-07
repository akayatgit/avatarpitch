import { NextRequest, NextResponse } from 'next/server';
import { processImagesInBackground } from '@/lib/generation/imageGenerationRunner';

/**
 * Background image generation API
 * Processes all scenes for a project and saves images incrementally to the database
 * This runs server-side and continues even if the client disconnects
 */
export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      scenes,
      referenceImageUrls,
      sceneReferenceImageUrls,
      model,
      numImages,
      aspectRatio,
      size,
      generationMode = 'fast',
    } = await request.json();

    console.log(`[generate-all-images] Received request for project ${projectId}, mode: ${generationMode}`);

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes array is required' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    // Ensure referenceImageUrls is an array
    const imageUrls = Array.isArray(referenceImageUrls)
      ? referenceImageUrls
      : referenceImageUrls
        ? [referenceImageUrls]
        : [];

    // Allow empty reference images; models may fall back to prompt-only generation.

    // Start background processing (don't await - return immediately)
    processImagesInBackground(
      projectId,
      scenes,
      imageUrls,
      sceneReferenceImageUrls,
      model,
      numImages || 1,
      aspectRatio || '9:16',
      size || '4K',
      generationMode
    ).catch((error) => {
      console.error('Background image generation error:', error);
    });

    // Return immediately - processing happens in background
    return NextResponse.json({
      success: true,
      message: 'Image generation started in background',
      projectId,
    });
  } catch (error) {
    console.error('Image generation API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start image generation' },
      { status: 500 }
    );
  }
}
