import { NextRequest, NextResponse } from 'next/server';
import { assemblePrompt } from '@/lib/workflows/assemblePrompt';
import type { WorkflowId } from '@/lib/workflows/types';

export const runtime = 'nodejs';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

/**
 * Shared Master Prompt assembly wrapper.
 * Body: { workflowId, inputs } — each workflow fills its own prompt book shape.
 */
export async function POST(request: NextRequest) {
  try {
    const { workflowId, inputs } = await request.json();

    if (workflowId !== 'drone-tracing-shot' && workflowId !== 'continuous-shot-path') {
      return NextResponse.json({ error: 'Invalid workflowId' }, { status: 400 });
    }

    if (!inputs || typeof inputs !== 'object') {
      return NextResponse.json({ error: 'inputs object is required' }, { status: 400 });
    }

    const result = await assemblePrompt(workflowId as WorkflowId, inputs);

    return NextResponse.json({
      success: true,
      prompt: result.prompt,
      duration: result.duration,
      pathAnalysis: result.pathAnalysis ?? null,
    });
  } catch (error) {
    console.error('Assemble prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assemble prompt' },
      { status: 500 }
    );
  }
}
