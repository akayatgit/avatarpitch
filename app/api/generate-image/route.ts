import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { put } from '@vercel/blob';
import {
  getModelConfig,
  ImageGenerationModel,
  PROMPT_ONLY_MODELS,
} from '@/lib/replicateImageGenerator';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Copy a (short-lived) Replicate output URL to durable Vercel Blob storage. */
async function persistImageToBlob(imageUrl: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return imageUrl;
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok || !response.body) {
      return imageUrl;
    }
    const blob = await put(`studio-images/image-${Date.now()}`, response.body, {
      access: 'public',
      contentType: response.headers.get('content-type') || 'image/png',
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (error) {
    console.error('Failed to persist image to blob storage:', error);
    return imageUrl;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scenePrompt, referenceImageUrls, model, numImages, aspectRatio, size, persist } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    // Ensure referenceImageUrls is an array
    const imageUrls = Array.isArray(referenceImageUrls) ? referenceImageUrls : 
                     (referenceImageUrls ? [referenceImageUrls] : []);

    const selectedModel = (model || 'gpt-image-2') as ImageGenerationModel;
    if (!PROMPT_ONLY_MODELS.includes(selectedModel) && imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one reference image URL is required' }, { status: 400 });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const modelConfig = getModelConfig(selectedModel);
    
    // Build input using the model config with all reference image URLs
    const input = modelConfig.buildInput(
      imageUrls, // All uploaded reference image URLs
      scenePrompt,
      null, // outfitUrl - can be added later
      numImages || 1,
      aspectRatio || '9:16',
      size || '4K'
    );

    // Run the model - Replicate.run expects model identifier and input
    const output = await replicate.run(modelConfig.modelId as `${string}/${string}`, { input });

    // Process output
    const results = await modelConfig.processOutput(output);

    let imageOutputUrls = results.map(r => r.url);
    if (persist === true) {
      imageOutputUrls = await Promise.all(imageOutputUrls.map(persistImageToBlob));
    }

    return NextResponse.json({ 
      success: true, 
      images: imageOutputUrls,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}

