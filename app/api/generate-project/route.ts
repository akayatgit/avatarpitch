import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateContent } from '@/lib/generation/contentGenerator';
import { ContentTypeDefinition } from '@/lib/schemas';
import { resolveAgentWorkflow } from '@/lib/agents';
import { extractDynamicInputs } from '@/lib/generation/dynamicInputExtractor';
import { resetGlobalMemory } from '@/lib/generation/agenticFramework';
import { planScenesDynamically } from '@/lib/generation/dynamicScenePlanner';
import { runDynamicAgentWorkflowForScene } from '@/lib/generation/dynamicSceneWorkflow';
import { generateFixedCarouselScenes } from '@/lib/generation/fixedCarouselGenerator';
import { GeneratedOutputSchema } from '@/lib/schemas';
import { processImagesInBackground } from '@/lib/generation/imageGenerationRunner';

/**
 * Background project generation API
 * Generates prompts in the background and updates the database
 * Then automatically starts image generation if reference images are provided
 */
export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      contentTypeId,
      inputs,
      referenceImageUrls,
      model,
      numImages,
      aspectRatio,
      size,
      generationMode,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch content type
    const { data: contentTypeData, error: contentTypeError } = await supabaseAdmin
      .from('content_types')
      .select('*')
      .eq('id', contentTypeId)
      .single();

    if (contentTypeError || !contentTypeData) {
      // Update project status to failed
      await supabaseAdmin
        .from('content_creation_requests')
        .update({ status: 'failed' })
        .eq('id', projectId);
      
      return NextResponse.json({ error: 'Content type not found' }, { status: 404 });
    }

    // Handle potential JSON string parsing
    let inputsContract = contentTypeData.inputs_contract;
    if (typeof inputsContract === 'string') {
      try {
        inputsContract = JSON.parse(inputsContract);
      } catch (e) {
        await supabaseAdmin
          .from('content_creation_requests')
          .update({ status: 'failed' })
          .eq('id', projectId);
        
        return NextResponse.json({ error: 'Invalid inputs contract' }, { status: 400 });
      }
    }

    // Convert database structure to ContentTypeDefinition format
    const contentType = {
      id: contentTypeData.id,
      name: contentTypeData.name,
      category: contentTypeData.category,
      description: contentTypeData.description,
      version: contentTypeData.version,
      outputContract: contentTypeData.output_contract,
      sceneGenerationPolicy: contentTypeData.scene_generation_policy,
      inputsContract: inputsContract,
      prompting: contentTypeData.prompting,
    };

    // Note: Status remains 'pending' during generation (database constraint doesn't allow 'processing')
    // The UI will check for scenes to determine if generation is in progress

    // Start background processing (don't await - return immediately)
    processProjectInBackground(
      projectId,
      contentType,
      inputs,
      referenceImageUrls,
      model,
      numImages,
      aspectRatio,
      size,
      generationMode
    ).catch(async (error) => {
      console.error('Background project generation error:', error);
      // Update status to failed on error
      try {
        await supabaseAdmin
          .from('content_creation_requests')
          .update({ status: 'failed' })
          .eq('id', projectId);
      } catch (updateError) {
        console.error('Error updating status to failed:', updateError);
      }
    });

    // Return immediately - processing happens in background
    return NextResponse.json({
      success: true,
      message: 'Project generation started in background',
      projectId,
    });
  } catch (error) {
    console.error('Error starting project generation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start project generation' },
      { status: 500 }
    );
  }
}

/**
 * Save a scene incrementally to the database
 */
async function saveSceneToDatabase(
  projectId: string,
  scene: any,
  existingScenes: any[],
  textOverlaySuggestions: string[],
  thumbnailPrompt: string,
  generationContext: any,
  isLastScene: boolean,
  referenceImageUrls: string[] | null,
  model: string | null,
  numImages: number | null,
  aspectRatio: string | null,
  size: string | null,
  generationMode: 'fast' | 'sequential' | null
) {
  try {
    const scenesWithContext = {
      ...scene,
      index: scene.index ?? (existingScenes.length + 1),
      generationContext: scene.generationContext || generationContext,
    };

    const updatedScenes = [...existingScenes, scenesWithContext];

    const generatedOutput = {
      format: 'storyboard_v1' as const,
      scenes: updatedScenes,
      textOverlaySuggestions,
      thumbnailPrompt,
      // Store image generation settings for regeneration
      imageGenerationSettings: model && numImages && aspectRatio && size ? {
        referenceImageUrls: referenceImageUrls || [],
        model,
        numImages,
        aspectRatio,
        size,
        generationMode: generationMode || 'fast',
      } : undefined,
    };

    // Update database with new scene (or mark as completed if last scene)
    // Note: Keep status as 'pending' during generation, only set to 'completed' when done
    const { error: updateError } = await supabaseAdmin
      .from('content_creation_requests')
      .update({
        generated_output: generatedOutput,
        status: isLastScene ? 'completed' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error saving scene to database:', updateError);
      throw updateError;
    }

    return updatedScenes;
  } catch (error) {
    console.error('Error in saveSceneToDatabase:', error);
    throw error;
  }
}

/**
 * Process project generation in the background
 * Generates scenes incrementally and saves them as they're created
 * 1. Generate prompts incrementally (save each scene as it's generated)
 * 2. Start image generation if reference images are provided
 */
// Helper function to check if generation should be stopped
async function shouldStopGeneration(projectId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('content_creation_requests')
      .select('status')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.status === 'cancelled';
  } catch (error) {
    console.error('Error checking stop status:', error);
    return false;
  }
}

async function processProjectInBackground(
  projectId: string,
  contentType: any,
  inputs: any,
  referenceImageUrls: string[] | null,
  model: string | null,
  numImages: number | null,
  aspectRatio: string | null,
  size: string | null,
  generationMode: 'fast' | 'sequential' | null
) {
  try {
    // Check if generation should be stopped before starting
    if (await shouldStopGeneration(projectId)) {
      console.log(`[generate-project] Generation stopped before starting for project ${projectId}`);
      return;
    }

    // Reset global memory for new generation session
    resetGlobalMemory();

    // Fixed-carousel content types (e.g. Job Openings Carousel) use a deterministic,
    // config-driven generator instead of the LLM scene planner + multi-agent pipeline.
    if (contentType.sceneGenerationPolicy?.mode === 'fixed_carousel') {
      await processFixedCarouselProject(
        projectId,
        contentType,
        inputs,
        model,
        numImages,
        aspectRatio,
        size,
        generationMode
      );
      return;
    }

    // Check if agent workflow exists
    const agentWorkflow = await resolveAgentWorkflow(contentType);

    // Extract dynamic inputs
    const dynamicInputs = extractDynamicInputs(contentType, inputs);

    // Plan scenes dynamically
    const sceneDictionary = await planScenesDynamically(contentType, dynamicInputs);
    const sceneCount = sceneDictionary.sceneCount;
    const scenePurposes = sceneDictionary.scenes;

    // Generation context
    const generationContext = {
      inputs,
      contentTypeName: contentType.name,
      systemPrompt: contentType.prompting.systemPromptTemplate,
    };

    const textOverlaySuggestions: string[] = [];
    const thumbnailPrompt = 'Thumbnail for the content';
    let allScenes: any[] = [];

    // Generate all scenes in parallel
    console.log(`[generate-project] Generating ${sceneCount} scenes in parallel for project ${projectId}`);
    
    const scenePromises = scenePurposes.map(async (sceneInfo, idx) => {
      // Check if generation should be stopped before processing this scene
      if (await shouldStopGeneration(projectId)) {
        console.log(`[generate-project] Generation stopped before scene ${idx + 1}/${sceneCount} for project ${projectId}`);
        return { success: false, error: 'Generation stopped', index: idx };
      }

      try {
        console.log(`[generate-project] Starting scene ${idx + 1}/${sceneCount} for project ${projectId}`);
        
        // Generate this scene
        const { scene, agentContributions } = await runDynamicAgentWorkflowForScene(
          sceneInfo,
          agentWorkflow,
          contentType,
          dynamicInputs
        );

        // Attach agent contributions and generation context
        const sceneWithContext = {
          ...scene,
          agentContributions: agentContributions.map(contrib => ({
            agentId: contrib.agentId,
            agentName: contrib.agentName,
            agentRole: contrib.agentRole,
            order: contrib.order,
            contribution: contrib.output,
            input: contrib.input,
          })),
          generationContext: {
            ...generationContext,
            userPromptContext: dynamicInputs,
            scenePurpose: scene.purpose,
            sceneSpecificContext: {
              purpose: scene.purpose,
              camera: scene.camera,
              environment: scene.environment,
              onScreenText: scene.onScreenText,
            },
          },
        };

        console.log(`[generate-project] Completed scene ${idx + 1}/${sceneCount} for project ${projectId}`);
        return { success: true, scene: sceneWithContext, index: idx };
      } catch (sceneError) {
        console.error(`[generate-project] Error generating scene ${idx + 1}/${sceneCount} for project ${projectId}:`, sceneError);
        return { success: false, error: sceneError, index: idx };
      }
    });

    // Wait for all scenes to be generated
    const sceneResults = await Promise.allSettled(scenePromises);

    // Process results and save scenes in order
    let hasFirstSceneFailure = false;

    // Sort results by index to ensure proper ordering
    const sortedResults = sceneResults
      .map((result, idx) => ({
        result,
        index: idx,
        value: result.status === 'fulfilled' ? result.value : null,
      }))
      .sort((a, b) => a.index - b.index);

    for (const { result, index: idx, value } of sortedResults) {
      if (result.status === 'fulfilled' && value && value.success) {
        const { scene } = value;
        const isLastScene = idx === sortedResults.length - 1;

        try {
          // Save scene to database immediately (in order)
          allScenes = await saveSceneToDatabase(
            projectId,
            scene,
            allScenes,
            textOverlaySuggestions,
            thumbnailPrompt,
            generationContext,
            isLastScene,
            referenceImageUrls,
            model,
            numImages,
            aspectRatio,
            size,
            generationMode
          );

          console.log(`[generate-project] Saved scene ${idx + 1}/${sceneCount} for project ${projectId}`);
        } catch (saveError) {
          console.error(`[generate-project] Error saving scene ${idx + 1}/${sceneCount} for project ${projectId}:`, saveError);
        }
      } else {
        // Scene generation failed
        if (idx === 0) {
          hasFirstSceneFailure = true;
        }
        console.error(`[generate-project] Scene ${idx + 1}/${sceneCount} failed for project ${projectId}`);
      }
    }

    // If first scene failed, mark as failed
    if (hasFirstSceneFailure) {
      try {
        await supabaseAdmin
          .from('content_creation_requests')
          .update({ status: 'failed' })
          .eq('id', projectId);
      } catch (updateError) {
        console.error('Error updating status to failed:', updateError);
      }
      throw new Error('First scene generation failed');
    }

    // Extract scene assets for reference image collection (no image generation yet)
    try {
      const { extractSceneAssets } = await import('@/lib/generation/sceneAssetExtractor');
      const assetRequirements = await extractSceneAssets(allScenes);

      const generatedOutput = {
        format: 'storyboard_v1' as const,
        scenes: allScenes,
        textOverlaySuggestions,
        thumbnailPrompt,
        imageGenerationSettings: model && numImages && aspectRatio && size ? {
          referenceImageUrls: referenceImageUrls || [],
          model,
          numImages,
          aspectRatio,
          size,
          generationMode: generationMode || 'fast',
        } : undefined,
        assetRequirements,
        assetUploads: {},
      };

      await supabaseAdmin
        .from('content_creation_requests')
        .update({
          generated_output: generatedOutput,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    } catch (error) {
      console.error(`[generate-project] Error extracting assets for project ${projectId}:`, error);
    }

    console.log(`Project ${projectId} generation completed successfully`);
  } catch (error) {
    console.error('Error in background project generation:', error);
    // Update status to failed and surface the message in the UI
    try {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      await supabaseAdmin
        .from('content_creation_requests')
        .update({
          status: 'failed',
          generated_output: { format: 'storyboard_v1', scenes: [], errorMessage },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    } catch (updateError) {
      console.error('Error updating status to failed:', updateError);
    }
  }
}

/**
 * Deterministic pipeline for "fixed_carousel" content types.
 * Builds all scenes in one shot (1 hook + N items + 1 CTA), wires each item's logo as a
 * per-scene reference image automatically, and immediately kicks off image generation —
 * no LLM scene planning, no multi-agent debate, no manual "upload reference asset" step.
 */
async function processFixedCarouselProject(
  projectId: string,
  contentType: any,
  inputs: any,
  model: string | null,
  numImages: number | null,
  aspectRatio: string | null,
  size: string | null,
  generationMode: 'fast' | 'sequential' | null
) {
  try {
    const dynamicInputs = extractDynamicInputs(contentType, inputs);
    const { scenes, sceneReferenceImageUrls, caption } = await generateFixedCarouselScenes(
      contentType,
      dynamicInputs
    );

    const generationContext = {
      inputs,
      contentTypeName: contentType.name,
      systemPrompt: contentType.prompting.systemPromptTemplate,
    };

    const scenesWithContext = scenes.map((scene: any) => ({
      ...scene,
      generationContext,
    }));

    // Fixed-carousel content types define their own ideal aspect ratio (matching the
    // reference layout) rather than relying on the generic form's default (9:16 reels).
    const contentTypeAspectRatio = contentType.outputContract?.globalDefaults?.defaultAspectRatio;

    const effectiveModel = model || 'gpt-image-2';
    const effectiveNumImages = numImages || 1;
    const effectiveAspectRatio = contentTypeAspectRatio || aspectRatio || '3:4';
    const effectiveSize = size || 'auto';
    const effectiveGenerationMode: 'fast' | 'sequential' = generationMode || 'sequential';

    const generatedOutput = {
      format: 'storyboard_v1' as const,
      scenes: scenesWithContext,
      textOverlaySuggestions: [] as string[],
      thumbnailPrompt: 'Thumbnail for the content',
      caption,
      imageGenerationSettings: {
        referenceImageUrls: [],
        sceneReferenceImageUrls,
        model: effectiveModel,
        numImages: effectiveNumImages,
        aspectRatio: effectiveAspectRatio,
        size: effectiveSize,
        generationMode: effectiveGenerationMode,
      },
      // No manual reference-asset step for this content type — logos are wired automatically.
      assetRequirements: null,
      assetUploads: {},
    };

    await supabaseAdmin
      .from('content_creation_requests')
      .update({
        generated_output: generatedOutput,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(
      `[generate-project] Fixed-carousel scenes saved for project ${projectId} (${scenesWithContext.length} slides). Starting automatic image generation...`
    );

    // Kick off image generation immediately — fire and forget, mirrors the dynamic flow.
    processImagesInBackground(
      projectId,
      scenesWithContext,
      [],
      sceneReferenceImageUrls,
      effectiveModel,
      effectiveNumImages,
      effectiveAspectRatio,
      effectiveSize,
      effectiveGenerationMode
    ).catch((error) => {
      console.error(`[generate-project] Auto image generation failed for project ${projectId}:`, error);
    });
  } catch (error) {
    console.error('Error in fixed-carousel project generation:', error);
    try {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      await supabaseAdmin
        .from('content_creation_requests')
        .update({
          status: 'failed',
          generated_output: { format: 'storyboard_v1', scenes: [], errorMessage },
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    } catch (updateError) {
      console.error('Error updating status to failed:', updateError);
    }
  }
}

