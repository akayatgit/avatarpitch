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
      model,
      numImages,
      aspectRatio,
      size,
    } = await request.json();

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

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image URL is required' },
        { status: 400 }
      );
    }

    // Start background processing (don't await - return immediately)
    processImagesInBackground(
      projectId,
      scenes,
      imageUrls,
      model,
      numImages || 1,
      aspectRatio || '9:16',
      size || '4K'
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
async function processImagesInBackground(
  projectId: string,
  scenes: any[],
  referenceImageUrls: string[],
  model: string,
  numImages: number,
  aspectRatio: string,
  size: string
) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN!,
  });

  const modelConfig = getModelConfig(model as ImageGenerationModel);
  const successfulImages: Array<{ sceneIndex: number; url: string }> = [];

  // Process each scene sequentially
  for (const scene of scenes) {
    const sceneIndex = scene.index ?? scenes.indexOf(scene) + 1;
    const scenePrompt = buildComprehensiveScenePrompt(scene, scenes);

    if (!scenePrompt) {
      console.warn(`Skipping scene ${sceneIndex}: no scene data available`);
      continue;
    }

    // Generate requested number of images for this scene
    for (let imageIndex = 0; imageIndex < numImages; imageIndex++) {
      try {
        // Build input using the model config
        const input = modelConfig.buildInput(
          referenceImageUrls,
          scenePrompt,
          null, // outfitUrl - can be added later
          1, // Always generate 1 image per call
          aspectRatio,
          size
        );

        // Run the model
        const output = await replicate.run(modelConfig.modelId as `${string}/${string}`, {
          input,
        });

        // Process output
        const results = await modelConfig.processOutput(output);

        if (results && results.length > 0 && results[0].url) {
          const imageUrl = results[0].url;
          successfulImages.push({
            sceneIndex,
            url: imageUrl,
          });

          // Save to database immediately after each image is generated
          await saveImageToDatabase(projectId, sceneIndex, imageUrl);

          console.log(
            `Generated and saved image ${imageIndex + 1}/${numImages} for scene ${sceneIndex}`
          );
        }
      } catch (error) {
        console.error(
          `Error generating image ${imageIndex + 1} for scene ${sceneIndex}:`,
          error
        );
        // Continue with next image even if one fails
      }
    }
  }

  console.log(
    `Background image generation completed for project ${projectId}. Generated ${successfulImages.length} images.`
  );
}

/**
 * Save a single image to the database immediately
 */
async function saveImageToDatabase(
  projectId: string,
  sceneIndex: number,
  imageUrl: string
) {
  try {
    // Fetch current project data
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching project:', fetchError);
      return;
    }

    // Parse generated_output
    let generatedOutput: any = {};
    try {
      generatedOutput =
        typeof request.generated_output === 'string'
          ? JSON.parse(request.generated_output)
          : request.generated_output || {};
    } catch (e) {
      console.error('Error parsing generated_output:', e);
      generatedOutput = {};
    }

    const scenes = generatedOutput.scenes || [];

    // Find the scene and add the image URL
    const updatedScenes = scenes.map((scene: any, idx: number) => {
      const currentSceneIndex = scene.index ?? idx + 1;
      if (currentSceneIndex === sceneIndex) {
        const existingUrls = scene.imageUrls || [];
        // Avoid duplicates
        if (!existingUrls.includes(imageUrl)) {
          return {
            ...scene,
            imageUrls: [...existingUrls, imageUrl],
          };
        }
      }
      return scene;
    });

    // Update the database
    const { error: updateError } = await supabaseAdmin
      .from('content_creation_requests')
      .update({
        generated_output: {
          ...generatedOutput,
          scenes: updatedScenes,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error updating project with new image:', updateError);
    }
  } catch (error) {
    console.error('Error saving image to database:', error);
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

  // Add Image Prompt if exists (with placeholder replacement)
  if (scene.imagePrompt) {
    const imagePrompt = replacePlaceholders(scene.imagePrompt, inputs);
    parts.push(`Image Prompt: ${imagePrompt}`);
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

