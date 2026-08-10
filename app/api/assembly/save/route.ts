import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AssemblyStateSchema, type AssemblyState } from '@/lib/assembly';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deriveStatus(state: AssemblyState): string {
  const hasVideos = state.buildings.some((building) => Boolean(building.videoUrl));
  return hasVideos ? 'completed' : 'pending';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = AssemblyStateSchema.safeParse(body?.state);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid assembly state' }, { status: 400 });
    }

    const state = parseResult.data;
    const projectId = typeof body?.projectId === 'string' ? body.projectId : null;
    const status = deriveStatus(state);
    const inputs = {
      source: 'assembly',
      aspectRatio: state.aspectRatio,
      buildingCount: state.buildings.length,
    };

    if (projectId) {
      const { error } = await supabaseAdmin
        .from('content_creation_requests')
        .update({ inputs, generated_output: state, status })
        .eq('id', projectId);

      if (error) {
        console.error('Failed to update assembly project:', error);
        return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
      }

      return NextResponse.json({ success: true, projectId });
    }

    let insertPayload: Record<string, unknown> = {
      content_type_id: null,
      inputs,
      generated_output: state,
      status,
      user_id: null,
    };

    let { data, error } = await supabaseAdmin
      .from('content_creation_requests')
      .insert(insertPayload)
      .select('id')
      .single();

    // Fallback: content_type_id may be NOT NULL in some deployments — attach any existing content type.
    if (error && error.code === '23502') {
      const { data: anyContentType } = await supabaseAdmin
        .from('content_types')
        .select('id')
        .limit(1)
        .single();

      if (anyContentType?.id) {
        insertPayload = { ...insertPayload, content_type_id: anyContentType.id };
        const retry = await supabaseAdmin
          .from('content_creation_requests')
          .insert(insertPayload)
          .select('id')
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error || !data?.id) {
      console.error('Failed to create assembly project:', error);
      return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
    }

    return NextResponse.json({ success: true, projectId: data.id });
  } catch (error) {
    console.error('Assembly save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save project' },
      { status: 500 }
    );
  }
}
