import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { JOB_REEL_FORMAT, isRenderStale } from '@/lib/jobReel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight render-status poll. The client (which may have left and come
 * back — e.g. Safari on iPhone) calls this every few seconds while a render
 * is in flight.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('content_creation_requests')
      .select('generated_output')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const state =
      typeof data.generated_output === 'string'
        ? JSON.parse(data.generated_output)
        : data.generated_output;

    if (!state || state.format !== JOB_REEL_FORMAT) {
      return NextResponse.json({ error: 'Not a job reel project' }, { status: 404 });
    }

    // A render that started long ago and never reported back is dead
    const stale = isRenderStale(state);

    return NextResponse.json({
      renderStatus: stale ? 'failed' : state.renderStatus ?? 'idle',
      renderError: stale
        ? 'The render timed out. Tap render to try again.'
        : state.renderError ?? null,
      finalVideoUrl: state.finalVideoUrl ?? null,
    });
  } catch (error) {
    console.error('Job reel status error:', error);
    return NextResponse.json({ error: 'Failed to read render status' }, { status: 500 });
  }
}
