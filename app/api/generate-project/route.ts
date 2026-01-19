import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateContent } from '@/lib/generation/contentGenerator';
import { ContentTypeDefinition } from '@/lib/schemas';
import { AgentWorkflow } from '@/lib/agents';
import { extractDynamicInputs } from '@/lib/generation/dynamicInputExtractor';
import { resetGlobalMemory } from '@/lib/generation/agenticFramework';
import { planScenesDynamically } from '@/lib/generation/dynamicScenePlanner';
import { runDynamicAgentWorkflowForScene } from '@/lib/generation/dynamicSceneWorkflow';
import { GeneratedOutputSchema } from '@/lib/schemas';

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
      size
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
 * Helper function to get agent workflow from content type
 */
function getAgentWorkflow(contentType: ContentTypeDefinition): AgentWorkflow | null {
  let agentWorkflow: any = contentType.prompting?.agentWorkflow;
  
  if (!agentWorkflow && contentType.prompting?.agents) {
    const agents = contentType.prompting.agents;
    if (Array.isArray(agents) && agents.length > 0) {
      const firstAgent = agents[0];
      if (typeof firstAgent === 'object' && firstAgent.id) {
        agentWorkflow = {
          agents: agents,
          executionOrder: 'sequential' as const,
        };
      } else if (typeof firstAgent === 'string') {
        agentWorkflow = {
          agents: (agents as string[]).map((agentName: string, idx: number) => ({
            id: `agent-${idx + 1}`,
            name: agentName,
            role: agentName.toLowerCase().replace(/\s+/g, '_'),
            order: idx + 1,
          })),
          executionOrder: 'sequential' as const,
        };
      }
    }
  }
  
  if (agentWorkflow && agentWorkflow.agents && agentWorkflow.agents.length > 0) {
    return agentWorkflow as AgentWorkflow;
  }
  
  return null;
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
  size: string | null
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
      imageGenerationSettings: referenceImageUrls && model && numImages && aspectRatio && size ? {
        referenceImageUrls,
        model,
        numImages,
        aspectRatio,
        size,
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
  size: string | null
) {
  try {
    // Check if generation should be stopped before starting
    if (await shouldStopGeneration(projectId)) {
      console.log(`[generate-project] Generation stopped before starting for project ${projectId}`);
      return;
    }

    // Reset global memory for new generation session
    resetGlobalMemory();

    // Check if agent workflow exists
    const agentWorkflow = getAgentWorkflow(contentType);
    
    if (!agentWorkflow) {
      throw new Error(
        `No agents configured for content type "${contentType.name}". ` +
        `Please configure agents in the workflow editor before generating content.`
      );
    }

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
            size
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

    // Step 3: Start image generation if reference images are provided (or if using Flux-Schnell which doesn't need them)
    const isFluxSchnell = model === 'flux-schnell';
    const hasRequiredImages = isFluxSchnell || (referenceImageUrls && referenceImageUrls.length > 0);
    
    console.log(`[generate-project] Checking image generation requirements for project ${projectId}:`, {
      hasReferenceImages: !!referenceImageUrls && referenceImageUrls.length > 0,
      referenceImageCount: referenceImageUrls?.length || 0,
      hasModel: !!model,
      isFluxSchnell: isFluxSchnell,
      hasNumImages: !!numImages,
      hasAspectRatio: !!aspectRatio,
      hasSize: !!size,
    });

    if (hasRequiredImages && model && numImages && aspectRatio && size) {
      // Use the scenes we just generated
      const scenes = allScenes;
      console.log(`[generate-project] Found ${scenes.length} scenes for project ${projectId}`);

      if (scenes.length > 0) {
        // Start background image generation
        // Import and call the processing function directly
        try {
          const { processImagesInBackground } = await import('../generate-all-images/route');
          
          // Ensure referenceImageUrls is an array
          const imageUrls = Array.isArray(referenceImageUrls)
            ? referenceImageUrls
            : referenceImageUrls
              ? [referenceImageUrls]
              : [];

          // Flux-Schnell doesn't require reference images, other models do
          const canGenerate = isFluxSchnell || imageUrls.length > 0;
          
          if (canGenerate && model && numImages && aspectRatio && size) {
            // Start background processing (don't await - return immediately)
            processImagesInBackground(
              projectId,
              scenes,
              imageUrls,
              model,
              numImages,
              aspectRatio,
              size
            ).catch((error) => {
              console.error(`[generate-project] Background image generation error for project ${projectId}:`, error);
            });

            console.log(`[generate-project] Image generation started for project ${projectId} with ${scenes.length} scenes, model: ${model}, ${imageUrls.length} reference images`);
          } else {
            console.warn(`[generate-project] Skipping image generation for project ${projectId}: missing required parameters`, {
              hasImages: imageUrls.length > 0,
              hasModel: !!model,
              hasNumImages: !!numImages,
              hasAspectRatio: !!aspectRatio,
              hasSize: !!size,
            });
          }
        } catch (error) {
          console.error(`[generate-project] Error starting image generation for project ${projectId}:`, error);
          // Don't fail the whole process if image generation fails to start
        }
      } else {
        console.warn(`[generate-project] No scenes found for project ${projectId}, skipping image generation`);
      }
    } else {
      const missingItems = [];
      if (!hasRequiredImages && !isFluxSchnell) missingItems.push('reference images');
      if (!model) missingItems.push('model');
      if (!numImages) missingItems.push('numImages');
      if (!aspectRatio) missingItems.push('aspectRatio');
      if (!size) missingItems.push('size');
      console.log(`[generate-project] Skipping image generation for project ${projectId}: missing ${missingItems.join(', ')}`);
    }

    console.log(`Project ${projectId} generation completed successfully`);
  } catch (error) {
    console.error('Error in background project generation:', error);
    // Update status to failed
    try {
      await supabaseAdmin
        .from('content_creation_requests')
        .update({ status: 'failed' })
        .eq('id', projectId);
    } catch (updateError) {
      console.error('Error updating status to failed:', updateError);
    }
  }
}

