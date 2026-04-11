import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { projectId, assetUploads } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!assetUploads || typeof assetUploads !== 'object') {
      return NextResponse.json({ error: 'assetUploads is required' }, { status: 400 });
    }

    const { data: requestData, error: fetchError } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (fetchError || !requestData) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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

    const existingUploads = generatedOutput.assetUploads || {};
    const mergedUploads = { ...existingUploads, ...assetUploads };

    const { error: updateError } = await supabaseAdmin
      .from('content_creation_requests')
      .update({
        generated_output: {
          ...generatedOutput,
          assetUploads: mergedUploads,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error updating asset uploads:', updateError);
      return NextResponse.json({ error: 'Failed to update asset uploads' }, { status: 500 });
    }

    return NextResponse.json({ success: true, assetUploads: mergedUploads });
  } catch (error) {
    console.error('Error updating project assets:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project assets' },
      { status: 500 }
    );
  }
}
