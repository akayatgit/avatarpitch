import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Stop generation API
 * Sets a flag in the database to stop ongoing generation tasks
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Update the project status to indicate it should be stopped
    // We'll use a metadata field or status to track this
    const { error } = await supabaseAdmin
      .from('content_creation_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) {
      console.error('Error stopping generation:', error);
      return NextResponse.json(
        { error: 'Failed to stop generation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Generation stop signal sent',
    });
  } catch (error) {
    console.error('Stop generation API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop generation' },
      { status: 500 }
    );
  }
}
