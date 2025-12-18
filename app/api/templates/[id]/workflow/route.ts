import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

// Disable caching for API routes
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { workflow } = await request.json();
    const contentTypeId = resolvedParams.id;

    // Fetch current content type
    const { data: contentType, error: fetchError } = await supabaseAdmin
      .from('content_types')
      .select('*')
      .eq('id', contentTypeId)
      .single();

    if (fetchError || !contentType) {
      console.error('Content type fetch error:', fetchError);
      return NextResponse.json({ error: 'Content type not found' }, { status: 404 });
    }

    // Extract agent names from workflow
    const agentNames = workflow.agents?.map((agent: any) => agent.name || agent.role) || [];

    // Update prompting field with agents and preserve other prompting fields
    const updatedPrompting = {
      ...contentType.prompting,
      agents: agentNames,
      // Store full workflow in a custom field for reference
      agentWorkflow: workflow,
    };

    const { data: updatedContentType, error: updateError } = await supabaseAdmin
      .from('content_types')
      .update({ 
        prompting: updatedPrompting,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentTypeId)
      .select('prompting')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Revalidate the templates page and workflow editor page to ensure fresh data
    revalidatePath('/app/templates');
    revalidatePath(`/app/templates/${contentTypeId}/workflow`);

    return NextResponse.json({ success: true, prompting: updatedContentType?.prompting });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

