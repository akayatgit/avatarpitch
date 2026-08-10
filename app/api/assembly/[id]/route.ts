import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AssemblyStateSchema, ASSEMBLY_FORMAT } from '@/lib/assembly';

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

    if (!rawOutput || rawOutput.format !== ASSEMBLY_FORMAT) {
      return NextResponse.json({ error: 'Not an assembly project' }, { status: 400 });
    }

    const parseResult = AssemblyStateSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Corrupted assembly project state' }, { status: 500 });
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
    console.error('Assembly load error:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}
