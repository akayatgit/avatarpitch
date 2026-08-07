import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { getModelConfig, ImageGenerationModel } from '@/lib/replicateImageGenerator';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    const getReferencesForScene = (sceneIndex: number): string[] => {
      if (sceneReferenceImageUrls && typeof sceneReferenceImageUrls === 'object') {
        const refs = sceneReferenceImageUrls[String(sceneIndex)] || [];
        return Array.from(new Set(refs));
      }
      return Array.from(new Set(imageUrls));
    };

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

/**
 * Process all scenes and generate images in the background
 * Saves images incrementally to the database as they're generated
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

async function runReplicateWithRetry(
  replicate: Replicate,
  modelId: string,
  input: Record<string, unknown>,
  label: string,
  maxAttempts = 5
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await replicate.run(modelId as `${string}/${string}`, { input });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const is429 = message.includes('429') || /throttled|rate limit/i.test(message);
      if (!is429 || attempt === maxAttempts) {
        throw error;
      }
      const waitMatch = message.match(/resets in ~(\d+)s/i);
      const waitSec = waitMatch ? Number(waitMatch[1]) + 1 : Math.min(5 * attempt, 30);
      console.warn(`[${label}] Rate limited (attempt ${attempt}/${maxAttempts}), waiting ${waitSec}s...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
  throw lastError;
}

export async function processImagesInBackground(
  projectId: string,
  scenes: any[],
  referenceImageUrls: string[],
  sceneReferenceImageUrls: Record<string, string[]> | null,
  model: string,
  numImages: number,
  aspectRatio: string,
  size: string,
  generationMode: 'fast' | 'sequential' = 'fast'
) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN!,
  });

  const selectedModel = (model || 'gpt-image-2') as ImageGenerationModel;
  // GPT Image 2 rate limits low-credit accounts — generate one at a time
  const effectiveMode =
    selectedModel === 'gpt-image-2' ? 'sequential' : generationMode;

  const modelConfig = getModelConfig(selectedModel);
  const successfulImages: Array<{ sceneIndex: number; url: string }> = [];

  // Check if generation should be stopped before starting
  if (await shouldStopGeneration(projectId)) {
    console.log(`[${projectId}] Generation stopped before starting`);
    return;
  }

  // Create all image generation tasks
  const imageGenerationTasks: Array<{
    sceneIndex: number;
    scenePrompt: string;
    imageIndex: number;
  }> = [];

  for (let idx = 0; idx < scenes.length; idx++) {
    const scene = scenes[idx];
    const sceneIndex = scene.index ?? idx + 1;
    const scenePrompt = buildComprehensiveScenePrompt(scene, scenes);

    if (!scenePrompt) {
      continue;
    }

    // Add tasks for all images for this scene
    for (let imageIndex = 0; imageIndex < numImages; imageIndex++) {
      imageGenerationTasks.push({
        sceneIndex,
        scenePrompt,
        imageIndex,
      });
    }
  }

  const getReferencesForScene = (sceneIndex: number): string[] => {
    if (sceneReferenceImageUrls && typeof sceneReferenceImageUrls === 'object') {
      const refs = sceneReferenceImageUrls[String(sceneIndex)] || [];
      return Array.from(new Set(refs));
    }
    return Array.from(new Set(referenceImageUrls));
  };

  if (effectiveMode === 'sequential') {
    // Sequential mode: generate one image at a time with scene-specific references
    console.log(`[${projectId}] Starting SEQUENTIAL image generation mode (${selectedModel}) with ${imageGenerationTasks.length} tasks`);

    // Sort tasks by scene index, then by image index to ensure proper order
    const sortedTasks = [...imageGenerationTasks].sort((a, b) => {
      if (a.sceneIndex !== b.sceneIndex) {
        return a.sceneIndex - b.sceneIndex;
      }
      return a.imageIndex - b.imageIndex;
    });
    
    const sceneOrder: number[] = [];
    for (const task of sortedTasks) {
      if (!sceneOrder.includes(task.sceneIndex)) {
        sceneOrder.push(task.sceneIndex);
      }
    }
    const firstImageByScene = new Map<number, string>();

    // Process each image one at a time (truly sequential)
    for (let i = 0; i < sortedTasks.length; i++) {
      const { sceneIndex, scenePrompt, imageIndex } = sortedTasks[i];
      
      // Check if generation should be stopped
      if (await shouldStopGeneration(projectId)) {
        console.log(`[${projectId}] Generation stopped at task ${i + 1}/${sortedTasks.length} (Scene ${sceneIndex}, Image ${imageIndex})`);
        break;
      }

      console.log(`[${projectId}] [SEQUENTIAL] Processing task ${i + 1}/${sortedTasks.length}: Scene ${sceneIndex}, Image ${imageIndex}`);

      try {
        // Build input using scene-specific references (+ previous scene's first image if available)
        const sceneRefs = getReferencesForScene(sceneIndex);
        const sceneOrderIndex = sceneOrder.indexOf(sceneIndex);
        const previousSceneIndex = sceneOrderIndex > 0 ? sceneOrder[sceneOrderIndex - 1] : null;
        const previousSceneFirstImage =
          previousSceneIndex != null ? firstImageByScene.get(previousSceneIndex) : null;
        const combinedRefs = previousSceneFirstImage && model !== 'flux-schnell'
          ? Array.from(new Set([...sceneRefs, previousSceneFirstImage]))
          : sceneRefs;

        const input = modelConfig.buildInput(
          combinedRefs,
          scenePrompt,
          null, // outfitUrl - can be added later
          1, // Always generate 1 image per call
          aspectRatio,
          size
        );

        const output = await runReplicateWithRetry(
          replicate,
          modelConfig.modelId,
          input,
          `${projectId} scene ${sceneIndex}`
        );

        // Process output
        const results = await modelConfig.processOutput(output);

        if (results && results.length > 0 && results[0].url) {
          const imageUrl = results[0].url;
          
          // Save to database immediately after each image is generated
          await saveImageToDatabase(projectId, sceneIndex, imageUrl, imageIndex);
          
          successfulImages.push({
            sceneIndex,
            url: imageUrl,
          });

          if (imageIndex === 0 && !firstImageByScene.has(sceneIndex)) {
            firstImageByScene.set(sceneIndex, imageUrl);
            console.log(`[${projectId}] [SEQUENTIAL] Scene ${sceneIndex} first image saved. Will use for next scene.`);
          }

          console.log(`[${projectId}] [SEQUENTIAL] Completed task ${i + 1}/${sortedTasks.length}: Scene ${sceneIndex}, Image ${imageIndex}`);
        } else {
          console.error(`[${projectId}] [SEQUENTIAL] No image URL in results for Scene ${sceneIndex}, Image ${imageIndex}`);
        }
      } catch (error) {
        console.error(`[${projectId}] [SEQUENTIAL] Generation failed for Scene ${sceneIndex}, Image ${imageIndex}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    console.log(`[${projectId}] [SEQUENTIAL] Completed all ${sortedTasks.length} tasks. Generated ${successfulImages.length} images.`);
  } else {
    // Fast mode: execute all image generations in parallel
    const imagePromises = imageGenerationTasks.map(async ({ sceneIndex, scenePrompt, imageIndex }) => {
      // Check if generation should be stopped before processing this task
      if (await shouldStopGeneration(projectId)) {
        return { success: false, sceneIndex, error: 'Generation stopped' };
      }

      try {
        // Build input using the model config
        const input = modelConfig.buildInput(
          getReferencesForScene(sceneIndex),
          scenePrompt,
          null, // outfitUrl - can be added later
          1, // Always generate 1 image per call
          aspectRatio,
          size
        );

        const output = await runReplicateWithRetry(
          replicate,
          modelConfig.modelId,
          input,
          `${projectId} scene ${sceneIndex}`
        );

        // Process output
        const results = await modelConfig.processOutput(output);

        if (results && results.length > 0 && results[0].url) {
          const imageUrl = results[0].url;
          
          // Save to database immediately after each image is generated
          // Pass imageIndex to track multiple images per scene
          await saveImageToDatabase(projectId, sceneIndex, imageUrl, imageIndex);

          return { success: true, sceneIndex, url: imageUrl };
        }

        return { success: false, sceneIndex, error: 'No image URL in results' };
      } catch (error) {
        console.error(`[Scene ${sceneIndex}] Generation failed:`, error instanceof Error ? error.message : 'Unknown error');
        return { success: false, sceneIndex, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Wait for all image generations to complete
    const imageResults = await Promise.allSettled(imagePromises);

    // Collect successful images
    for (const result of imageResults) {
      if (result.status === 'fulfilled' && result.value.success && result.value.url) {
        successfulImages.push({
          sceneIndex: result.value.sceneIndex,
          url: result.value.url,
        });
      }
    }
  }
}

/**
 * Save a single image to the database immediately
 * Uses the generated_images table to avoid race conditions with concurrent writes
 * Each image is inserted as a separate row, so concurrent inserts don't conflict
 */
async function saveImageToDatabase(
  projectId: string,
  sceneIndex: number,
  imageUrl: string,
  imageIndex: number = 0
) {
  const maxRetries = 5;
  const retryDelay = 100; // Start with 100ms delay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Insert into generated_images table
      // The UNIQUE constraint on (content_creation_request_id, scene_index, image_index)
      // will prevent duplicates, and concurrent inserts won't overwrite each other
      const { error: insertError } = await supabaseAdmin
        .from('generated_images')
        .insert({
          content_creation_request_id: projectId,
          scene_index: sceneIndex,
          image_url: imageUrl,
          image_index: imageIndex,
        })
        .select()
        .single();

      if (insertError) {
        // Check if it's a duplicate key error (23505 is PostgreSQL unique violation)
        if (insertError.code === '23505') {
          // Image already exists, that's fine - no need to retry
          return;
        }

        // For other errors, retry
        if (attempt === maxRetries - 1) {
          console.error(`[Scene ${sceneIndex}] Failed to save image after ${maxRetries} attempts:`, insertError);
        }
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
        return;
      }

      // Success - log minimal info
      console.log(`[Scene ${sceneIndex}] Saved: ${imageUrl}`);
      return;

    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`[Scene ${sceneIndex}] Error after ${maxRetries} attempts:`, error);
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      return;
    }
  }
}

/**
 * Replace placeholders in text with actual input values
 * This matches the logic in ProjectResults.tsx
 */
function replacePlaceholders(text: string, inputs: any): string {
  if (!text || !inputs) return text;

  let replaced = text;

  // Product/Subject name - handle all case variations
  const productName = inputs.subject?.name;
  if (productName) {
    replaced = replaced.replace(/\[PRODUCT\s+NAME\]/gi, productName);
    replaced = replaced.replace(/\[PRODUCT_NAME\]/gi, productName);
    replaced = replaced.replace(/\[SUBJECT\s+NAME\]/gi, productName);
    replaced = replaced.replace(/\[SUBJECT_NAME\]/gi, productName);
    replaced = replaced.replace(/\[product\s+name\]/gi, productName);
    replaced = replaced.replace(/\[subject\s+name\]/gi, productName);
  }

  // Product category
  if (inputs.subject?.product?.category) {
    replaced = replaced.replace(/\[PRODUCT CATEGORY\]/gi, inputs.subject.product.category);
    replaced = replaced.replace(/\[PRODUCT_CATEGORY\]/gi, inputs.subject.product.category);
    replaced = replaced.replace(/\[CATEGORY\]/gi, inputs.subject.product.category);
  }

  // Product material
  if (inputs.subject?.product?.material) {
    replaced = replaced.replace(/\[PRODUCT MATERIAL\]/gi, inputs.subject.product.material);
    replaced = replaced.replace(/\[PRODUCT_MATERIAL\]/gi, inputs.subject.product.material);
    replaced = replaced.replace(/\[MATERIAL\]/gi, inputs.subject.product.material);
  }

  // Product fit
  if (inputs.subject?.product?.fit) {
    replaced = replaced.replace(/\[PRODUCT FIT\]/gi, inputs.subject.product.fit);
    replaced = replaced.replace(/\[PRODUCT_FIT\]/gi, inputs.subject.product.fit);
    replaced = replaced.replace(/\[FIT\]/gi, inputs.subject.product.fit);
  }

  // Product colors
  if (inputs.subject?.product?.colors && inputs.subject.product.colors.length > 0) {
    const colorsStr = inputs.subject.product.colors.join(', ');
    replaced = replaced.replace(/\[PRODUCT COLORS\]/gi, colorsStr);
    replaced = replaced.replace(/\[PRODUCT_COLORS\]/gi, colorsStr);
    replaced = replaced.replace(/\[COLORS\]/gi, colorsStr);
  }

  // Product features/key points
  if (inputs.subject?.product?.keyPoints && inputs.subject.product.keyPoints.length > 0) {
    const featuresStr = inputs.subject.product.keyPoints.join(', ');
    replaced = replaced.replace(/\[PRODUCT FEATURES\]/gi, featuresStr);
    replaced = replaced.replace(/\[PRODUCT_FEATURES\]/gi, featuresStr);
    replaced = replaced.replace(/\[FEATURES\]/gi, featuresStr);
    replaced = replaced.replace(/\[KEY POINTS\]/gi, featuresStr);
    replaced = replaced.replace(/\[KEY_POINTS\]/gi, featuresStr);
  }

  // Offer text
  if (inputs.offer?.text) {
    replaced = replaced.replace(/\[OFFER\]/gi, inputs.offer.text);
    replaced = replaced.replace(/\[OFFER TEXT\]/gi, inputs.offer.text);
    replaced = replaced.replace(/\[OFFER_TEXT\]/gi, inputs.offer.text);
  }

  // Target audience
  if (inputs.audience?.description) {
    replaced = replaced.replace(/\[TARGET AUDIENCE\]/gi, inputs.audience.description);
    replaced = replaced.replace(/\[TARGET_AUDIENCE\]/gi, inputs.audience.description);
    replaced = replaced.replace(/\[AUDIENCE\]/gi, inputs.audience.description);
  }

  // Platform
  if (inputs.platform) {
    replaced = replaced.replace(/\[PLATFORM\]/gi, inputs.platform);
  }

  // Goal
  if (inputs.goal) {
    replaced = replaced.replace(/\[GOAL\]/gi, inputs.goal);
  }

  // Language
  if (inputs.language) {
    replaced = replaced.replace(/\[LANGUAGE\]/gi, inputs.language);
  }

  // Tone
  if (inputs.tone && Array.isArray(inputs.tone) && inputs.tone.length > 0) {
    const toneStr = inputs.tone.join(', ');
    replaced = replaced.replace(/\[TONE\]/gi, toneStr);
  }

  // Brand name
  if (inputs.brandCreator?.brandName) {
    replaced = replaced.replace(/\[BRAND NAME\]/gi, inputs.brandCreator.brandName);
    replaced = replaced.replace(/\[BRAND_NAME\]/gi, inputs.brandCreator.brandName);
    replaced = replaced.replace(/\[BRAND\]/gi, inputs.brandCreator.brandName);
  }

  // Story fields
  if (inputs.subject?.story) {
    if (inputs.subject.story.characters && inputs.subject.story.characters.length > 0) {
      const charactersStr = inputs.subject.story.characters.join(', ');
      replaced = replaced.replace(/\[CHARACTERS\]/gi, charactersStr);
    }
    if (inputs.subject.story.setting) {
      replaced = replaced.replace(/\[SETTING\]/gi, inputs.subject.story.setting);
    }
    if (inputs.subject.story.theme) {
      replaced = replaced.replace(/\[THEME\]/gi, inputs.subject.story.theme);
    }
    if (inputs.subject.story.conflict) {
      replaced = replaced.replace(/\[CONFLICT\]/gi, inputs.subject.story.conflict);
    }
  }

  return replaced;
}

/**
 * Build comprehensive scene prompt from all scene fields
 * This matches the logic in ProjectResults.tsx
 */
function buildComprehensiveScenePrompt(scene: any, allScenes: any[]): string {
  // Get inputs from generationContext - try multiple paths
  let inputs = scene.generationContext?.inputs;
  if (!inputs && allScenes && allScenes.length > 0) {
    inputs = allScenes[0]?.generationContext?.inputs;
  }

  const parts: string[] = [];

  const extractTimelineSection = (text: string) => {
    const timelineMatch = text.match(/(?:^|\n)\s*0\.0s\s*-\s[\s\S]*/i);
    if (!timelineMatch) {
      return { cleaned: text, timeline: null as string | null };
    }
    const timelineStart = timelineMatch.index ?? text.indexOf(timelineMatch[0]);
    const cleaned = text.slice(0, timelineStart).trim();
    const timeline = text.slice(timelineStart).trim();
    return { cleaned, timeline };
  };

  // Add Image Prompt if exists (with placeholder replacement)
  if (scene.imagePrompt) {
    const imagePrompt = replacePlaceholders(scene.imagePrompt, inputs);
    const { cleaned } = extractTimelineSection(imagePrompt);
    if (cleaned) {
      parts.push(`Image Prompt: ${cleaned}`);
    }
  }

  // Add Negative Prompt if exists (with placeholder replacement)
  if (scene.negativePrompt) {
    const negativePrompt = replacePlaceholders(scene.negativePrompt, inputs);
    parts.push(`Negative Prompt: ${negativePrompt}`);
  }

  // Add Camera information (with placeholder replacement)
  if (scene.camera) {
    if (typeof scene.camera === 'string') {
      const camera = replacePlaceholders(scene.camera, inputs);
      parts.push(`Camera: ${camera}`);
    } else {
      const cameraParts: string[] = [];
      if (scene.camera.shot) cameraParts.push(replacePlaceholders(scene.camera.shot, inputs));
      if (scene.camera.lens) cameraParts.push(replacePlaceholders(scene.camera.lens, inputs));
      if (scene.camera.movement) cameraParts.push(replacePlaceholders(scene.camera.movement, inputs));
      if (cameraParts.length > 0) {
        parts.push(`Camera: ${cameraParts.join(', ')}`);
      }
    }
  }

  // Add Environment information (with placeholder replacement)
  if (scene.environment) {
    if (typeof scene.environment === 'string') {
      const environment = replacePlaceholders(scene.environment, inputs);
      parts.push(`Environment: ${environment}`);
    } else {
      const envParts: string[] = [];
      if (scene.environment.location) envParts.push(replacePlaceholders(scene.environment.location, inputs));
      if (scene.environment.timeOfDay) envParts.push(replacePlaceholders(scene.environment.timeOfDay, inputs));
      if (scene.environment.lighting) envParts.push(replacePlaceholders(scene.environment.lighting, inputs));
      if (envParts.length > 0) {
        parts.push(`Environment: ${envParts.join(', ')}`);
      }
    }
  }

  // Add On-screen Text (with placeholder replacement)
  if (scene.onScreenText) {
    if (typeof scene.onScreenText === 'string') {
      const onScreenText = replacePlaceholders(scene.onScreenText, inputs);
      parts.push(`On-screen Text: ${onScreenText}`);
    } else {
      const textParts: string[] = [];
      if (scene.onScreenText.text) textParts.push(replacePlaceholders(scene.onScreenText.text, inputs));
      if (scene.onScreenText.styleNotes) textParts.push(`(${replacePlaceholders(scene.onScreenText.styleNotes, inputs)})`);
      if (textParts.length > 0) {
        parts.push(`On-screen Text: ${textParts.join(' ')}`);
      }
    }
  }

  // Add Composition Notes (with placeholder replacement)
  if (scene.compositionNotes) {
    const compositionNotes = replacePlaceholders(scene.compositionNotes, inputs);
    parts.push(`Composition Notes: ${compositionNotes}`);
  }

  // Add any other fields dynamically (excluding known fields and metadata)
  const knownFields = ['id', 'index', 'purpose', 'imagePrompt', 'negativePrompt', 'camera', 'environment', 'onScreenText', 'compositionNotes', 'agentContributions', 'finalAssembler', 'imageUrls', 'generationContext', 'shotType', 'notes', 'durationSeconds'];
  for (const [key, value] of Object.entries(scene)) {
    if (!knownFields.includes(key) && value !== null && value !== undefined && value !== '') {
      // Format the field name (convert camelCase to Title Case)
      const fieldName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      if (typeof value === 'object' && !Array.isArray(value)) {
        // For objects, stringify them nicely with placeholder replacement
        const objStr = Object.entries(value)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => {
            const valStr = typeof v === 'string' ? replacePlaceholders(v, inputs) : String(v);
            return `${k}: ${valStr}`;
          })
          .join(', ');
        if (objStr) {
          parts.push(`${fieldName}: ${objStr}`);
        }
      } else if (typeof value === 'string') {
        const replacedValue = replacePlaceholders(value, inputs);
        parts.push(`${fieldName}: ${replacedValue}`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        parts.push(`${fieldName}: ${value}`);
      }
    }
  }

  return parts.join('\n\n');
}

