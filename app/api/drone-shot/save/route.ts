import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { DroneShotStateSchema, type DroneShotState } from '@/lib/droneShot';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deriveStatus(state: DroneShotState): string {
  return state.videoUrl ? 'completed' : 'pending';
}

/**
 * The annotated path image comes from the canvas as a large base64 data URL.
 * Re-host it in Supabase Storage so the jsonb row stays small and the image
 * survives across sessions. Falls back to the data URL if the upload fails.
 */
async function persistAnnotatedImage(state: DroneShotState): Promise<DroneShotState> {
  const image = state.annotatedImage;
  if (!image || !image.startsWith('data:')) return state;

  try {
    const match = image.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/);
    if (!match) return state;
    const [, contentType, base64] = match;
    const extension = contentType.split('/')[1]?.replace('+xml', '') || 'png';
    const url = await uploadPublicFile({
      path: buildUploadPath('drone-shot/paths', `path.${extension}`),
      body: Buffer.from(base64, 'base64'),
      contentType,
    });
    return { ...state, annotatedImage: url };
  } catch (error) {
    console.error('Failed to persist annotated path image:', error);
    return state;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = DroneShotStateSchema.safeParse(body?.state);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid drone shot state' }, { status: 400 });
    }

    const state = await persistAnnotatedImage(parseResult.data);
    const projectId = typeof body?.projectId === 'string' ? body.projectId : null;
    const status = deriveStatus(state);
    const inputs = {
      source: 'drone-shot',
      topic: state.ideation?.topic ?? '',
      duration: state.duration,
      // Projects list reads this key for the display name
      'PRODUCT NAME': state.ideation
        ? `Drone Shot — ${state.ideation.suggestion.title}`
        : 'Drone Shot',
    };

    if (projectId) {
      const { error } = await supabaseAdmin
        .from('content_creation_requests')
        .update({ inputs, generated_output: state, status })
        .eq('id', projectId);

      if (error) {
        console.error('Failed to update drone shot project:', error);
        return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
      }

      return NextResponse.json({ success: true, projectId, state });
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
      console.error('Failed to create drone shot project:', error);
      return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
    }

    return NextResponse.json({ success: true, projectId: data.id, state });
  } catch (error) {
    console.error('Drone shot save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save project' },
      { status: 500 }
    );
  }
}
