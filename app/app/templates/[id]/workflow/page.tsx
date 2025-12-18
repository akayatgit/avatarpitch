import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import ReactFlowWorkflowEditor from '@/components/ReactFlowWorkflowEditor';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // In Next.js 15+, params is a Promise and needs to be awaited
  const resolvedParams = await params;
  const templateId = resolvedParams.id;
  
  const { data: contentType, error } = await supabaseAdmin
    .from('content_types')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!contentType || error) {
    console.error('Content type fetch error:', error);
    notFound();
  }

  // Convert content type to config format for workflow editor
  // The workflow editor expects the old config format with workflow.agentWorkflow
  // Check if agentWorkflow is stored in prompting.agentWorkflow (from API save) or prompting.agents (simple array)
  let agentWorkflow: any = null;
  
  // First, check if agentWorkflow exists directly in prompting
  if (contentType.prompting?.agentWorkflow) {
    agentWorkflow = contentType.prompting.agentWorkflow;
  } 
  // Otherwise, try to construct from agents array
  else if (contentType.prompting?.agents) {
    if (Array.isArray(contentType.prompting.agents) && contentType.prompting.agents.length > 0) {
      // Check if it's an array of agent names (strings) or agent objects
      const firstAgent = contentType.prompting.agents[0];
      if (typeof firstAgent === 'string') {
        // Array of agent names - convert to agent workflow
        agentWorkflow = {
          agents: contentType.prompting.agents.map((agentName: string, idx: number) => ({
            id: `agent-${idx + 1}`,
            name: agentName,
            role: agentName.toLowerCase().replace(/\s+/g, '_'),
            order: idx + 1,
          })),
          executionOrder: 'sequential' as const,
        };
      } else {
        // Array of agent objects - use directly
        agentWorkflow = {
          agents: contentType.prompting.agents,
          executionOrder: 'sequential' as const,
        };
      }
    }
  }

  const config = {
    version: 1,
    output: {
      sceneCount: contentType.scene_generation_policy?.maxScenes || 5,
      minSceneSeconds: contentType.output_contract?.globalDefaults?.durationPerSceneSeconds || 3,
      maxSceneSeconds: contentType.output_contract?.globalDefaults?.durationPerSceneSeconds || 7,
      aspectRatio: contentType.output_contract?.globalDefaults?.defaultAspectRatio || '9:16',
      style: contentType.output_contract?.globalDefaults?.visualStylePreset || 'ugc',
    },
    workflow: {
      systemPrompt: contentType.prompting?.systemPromptTemplate || '',
      agentWorkflow: agentWorkflow || {
        agents: [],
        executionOrder: 'sequential' as const,
      },
      constraints: [],
    },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Workflow Editor: {contentType.name}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Configure agent workflows for video generation
        </p>
      </div>

      <ReactFlowWorkflowEditor templateId={templateId} initialConfig={config} />
    </div>
  );
}

