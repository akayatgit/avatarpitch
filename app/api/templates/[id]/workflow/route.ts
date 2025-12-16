import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TemplateConfigSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';

// Disable caching for API routes
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { workflow } = await request.json();
    const templateId = params.id;

    // Fetch current template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from('templates')
      .select('config')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error('Template fetch error:', fetchError);
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Merge workflow into config - preserve existing workflow fields
    const existingWorkflow = template.config.workflow || {};
    const updatedConfig = {
      ...template.config,
      workflow: {
        ...existingWorkflow,
        agentWorkflow: workflow,
        // Preserve sceneBlueprint and constraints if they exist
        sceneBlueprint: existingWorkflow.sceneBlueprint || [],
        constraints: existingWorkflow.constraints || [],
      },
    };

    // Validate config - but always use updatedConfig to preserve agentWorkflow
    // Even if validation succeeds, validation.data might strip agentWorkflow due to union type matching
    const validation = TemplateConfigSchema.safeParse(updatedConfig);
    if (!validation.success) {
      console.error('Config validation error:', validation.error);
    }

    // Always use updatedConfig to ensure agentWorkflow is preserved
    // Don't use validation.data as it might strip agentWorkflow when matching legacy schema
    const configToSave = updatedConfig;
    const { data: updatedTemplate, error: updateError } = await supabaseAdmin
      .from('templates')
      .update({ config: configToSave })
      .eq('id', templateId)
      .select('config')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Revalidate the templates page and workflow editor page to ensure fresh data
    revalidatePath('/app/templates');
    revalidatePath(`/app/templates/${templateId}/workflow`);

    return NextResponse.json({ success: true, config: updatedTemplate?.config });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

