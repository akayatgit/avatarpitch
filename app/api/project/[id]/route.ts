import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Fetch from content_creation_requests
    const { data: request, error: requestError } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output, status')
      .eq('id', projectId)
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch generated images from the new table
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('generated_images')
      .select('scene_index, image_url, image_index')
      .eq('content_creation_request_id', projectId)
      .order('scene_index', { ascending: true })
      .order('image_index', { ascending: true });

    if (imagesError) {
      console.error('Error fetching generated images:', imagesError);
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
    }

    // Group images by scene_index
    const imagesByScene = new Map<number, string[]>();
    if (images) {
      for (const img of images) {
        if (!imagesByScene.has(img.scene_index)) {
          imagesByScene.set(img.scene_index, []);
        }
        imagesByScene.get(img.scene_index)!.push(img.image_url);
      }
    }

    // Merge imageUrls into scenes from generated_output
    const scenes = (generatedOutput.scenes || []).map((scene: any, idx: number) => {
      const sceneIndex = scene.index ?? (idx + 1);
      const imageUrls = imagesByScene.get(sceneIndex) || [];
      
      return {
        ...scene,
        imageUrls: imageUrls.length > 0 ? imageUrls : (scene.imageUrls || []),
      };
    });

    return NextResponse.json(
      {
        scenes: scenes,
        status: request.status || 'pending',
        imageGenerationSettings: generatedOutput.imageGenerationSettings || null,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

