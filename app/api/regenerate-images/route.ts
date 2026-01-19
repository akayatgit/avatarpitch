import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processImagesInBackground } from '../generate-all-images/route';

/**
 * Regenerate images API
 * Can regenerate all images or images for a single scene
 * Clears existing images before regenerating
 */
export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      sceneIndex, // Optional: if provided, regenerate only this scene
      updatedImagePrompt,
      referenceImageUrls,
      model,
      numImages,
      aspectRatio,
      size,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    // Fetch current project data
    const { data: requestData, error: fetchError } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (fetchError || !requestData) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse generated_output
    let generatedOutput: any = {};
    try {
      generatedOutput =
        typeof requestData.generated_output === 'string'
          ? JSON.parse(requestData.generated_output)
          : requestData.generated_output || {};
    } catch (e) {
      console.error('Error parsing generated_output:', e);
      generatedOutput = {};
    }

    const scenes = generatedOutput.scenes || [];

    if (scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes found for this project' }, { status: 400 });
    }

    // Filter scenes if sceneIndex is provided
    let scenesToProcess = scenes;
    if (sceneIndex !== undefined && sceneIndex !== null) {
      scenesToProcess = scenes.filter((scene: any, idx: number) => {
        const currentSceneIndex = scene.index ?? (idx + 1);
        return currentSceneIndex === sceneIndex;
      });

      if (scenesToProcess.length === 0) {
        return NextResponse.json({ error: `Scene ${sceneIndex} not found` }, { status: 404 });
      }
    }

    if (updatedImagePrompt && sceneIndex !== undefined && sceneIndex !== null) {
      const updatedScenes = scenes.map((scene: any, idx: number) => {
        const currentSceneIndex = scene.index ?? (idx + 1);
        if (currentSceneIndex !== sceneIndex) {
          return scene;
        }
        return {
          ...scene,
          imagePrompt: updatedImagePrompt,
        };
      });
      generatedOutput.scenes = updatedScenes;

      const { error: updateError } = await supabaseAdmin
        .from('content_creation_requests')
        .update({ generated_output: generatedOutput })
        .eq('id', projectId);

      if (updateError) {
        console.error('Error updating scene prompt:', updateError);
        return NextResponse.json({ error: 'Failed to update scene prompt' }, { status: 500 });
      }
    }

    // Clear existing images from the generated_images table for the scenes to be regenerated
    let deleteQuery = supabaseAdmin
      .from('generated_images')
      .delete()
      .eq('content_creation_request_id', projectId);

    // If a specific scene is provided, only delete images for that scene
    if (sceneIndex !== undefined && sceneIndex !== null) {
      deleteQuery = deleteQuery.eq('scene_index', sceneIndex);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('Error clearing images:', deleteError);
      return NextResponse.json({ error: 'Failed to clear existing images' }, { status: 500 });
    }

    // Ensure referenceImageUrls is an array
    const imageUrls = Array.isArray(referenceImageUrls)
      ? referenceImageUrls
      : referenceImageUrls
        ? [referenceImageUrls]
        : [];

    // Flux-Schnell doesn't require reference images
    const selectedModel = model || 'flux-schnell';
    if (selectedModel !== 'flux-schnell' && imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image URL is required' },
        { status: 400 }
      );
    }

    // Start background processing (don't await - return immediately)
    processImagesInBackground(
      projectId,
      scenesToProcess.map((scene: any, idx: number) => {
        if (!updatedImagePrompt || sceneIndex === undefined || sceneIndex === null) {
          return scene;
        }
        const currentSceneIndex = scene.index ?? (idx + 1);
        return currentSceneIndex === sceneIndex ? { ...scene, imagePrompt: updatedImagePrompt } : scene;
      }),
      imageUrls,
      model || 'flux-schnell',
      numImages || 1,
      aspectRatio || '9:16',
      size || '4K'
    ).catch((error) => {
      console.error('Background image regeneration error:', error);
    });

    // Return immediately - processing happens in background
    return NextResponse.json({
      success: true,
      message: sceneIndex 
        ? `Image regeneration started for scene ${sceneIndex}` 
        : 'Image regeneration started for all scenes',
      projectId,
    });
  } catch (error) {
    console.error('Image regeneration API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start image regeneration' },
      { status: 500 }
    );
  }
}
