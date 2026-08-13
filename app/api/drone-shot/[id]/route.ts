import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { DroneShotStateSchema, DRONE_SHOT_FORMAT } from '@/lib/droneShot';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('content_creation_requests')
      .select('id, generated_output, status')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rawOutput =
      typeof data.generated_output === 'string'
        ? JSON.parse(data.generated_output)
        : data.generated_output;

    if (!rawOutput || rawOutput.format !== DRONE_SHOT_FORMAT) {
      return NextResponse.json({ error: 'Not a drone shot project' }, { status: 400 });
    }

    const parseResult = DroneShotStateSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Corrupted drone shot project state' }, { status: 500 });
    }

    return NextResponse.json(
      { projectId: data.id, state: parseResult.data, status: data.status },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Drone shot load error:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}
