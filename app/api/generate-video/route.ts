import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, prompt, fps, duration, resolution, aspectRatio, cameraFixed } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image URL is required' }, { status: 400 });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Use the first image URL as input for video generation
    // Note: The seedance model typically uses a single image input
    const inputImageUrl = imageUrls[0];

    const input = {
      fps: fps || 24,
      prompt: prompt || 'model showcasing the jewellery with smile and head movement',
      duration: duration || 5,
      resolution: resolution || '720p',
      aspect_ratio: aspectRatio || '9:16',
      camera_fixed: cameraFixed !== undefined ? cameraFixed : true,
      image: inputImageUrl, // The image input parameter for seedance model
    };

    // Run the seedance model
    const output = await replicate.run('bytedance/seedance-1-pro-fast', { input });

    // Process output - handle various output formats
    // According to user's reference, output may have a .url() method directly
    let videoUrl: string | null = null;
    
    if (output && typeof output.url === 'function') {
      // Handle case where output itself has .url() method
      const urlResult = output.url();
      videoUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
    } else if (typeof output === 'string') {
      // Handle case where output is directly a URL string
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      // Handle array output
      const firstItem = output[0];
      if (typeof firstItem === 'string') {
        videoUrl = firstItem;
      } else if (firstItem && typeof firstItem.url === 'function') {
        const urlResult = firstItem.url();
        videoUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
      } else if (firstItem && typeof firstItem === 'object' && firstItem.url) {
        videoUrl = typeof firstItem.url === 'string' ? firstItem.url : String(firstItem.url);
      }
    } else if (output && typeof output === 'object' && output.url) {
      // Handle object with url property (string)
      videoUrl = typeof output.url === 'string' ? output.url : String(output.url);
    }

    if (!videoUrl) {
      console.error('Unexpected output format from Replicate:', JSON.stringify(output, null, 2));
      throw new Error('Unexpected output format from Replicate - no valid video URL found');
    }

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status: 500 }
    );
  }
}

