import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { getModelConfig, ImageGenerationModel } from '@/lib/replicateImageGenerator';

export async function POST(request: NextRequest) {
  try {
    const { scenePrompt, referenceImageUrl, model, screenshotUrl, numImages, aspectRatio, size } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const modelConfig = getModelConfig(model as ImageGenerationModel);
    
    // Build input using the model config with user-provided options
    const input = modelConfig.buildInput(
      screenshotUrl || referenceImageUrl, // Use screenshot if available, otherwise reference
      referenceImageUrl,
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

    return NextResponse.json({ 
      success: true, 
      images: results.map(r => r.url),
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}

