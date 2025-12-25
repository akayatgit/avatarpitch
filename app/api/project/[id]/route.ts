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
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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

    return NextResponse.json(
      {
        scenes: generatedOutput.scenes || [],
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

