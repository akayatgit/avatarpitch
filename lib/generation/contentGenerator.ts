import { ContentTypeDefinition, ContentCreationRequest } from '../schemas';
import { AgentWorkflow } from '../agents';
import { extractDynamicInputs } from './dynamicInputExtractor';
import { resetGlobalMemory } from './agenticFramework';
import { generateScenesDynamically } from './dynamicMultiAgentSceneGenerator';

interface GenerateContentInput {
  contentType: ContentTypeDefinition;
  inputs: ContentCreationRequest['inputs'];
}

// Helper function to check if agent workflow exists
function getAgentWorkflow(contentType: ContentTypeDefinition): AgentWorkflow | null {
  // Check if agentWorkflow exists in prompting.agentWorkflow
  let agentWorkflow: any = contentType.prompting?.agentWorkflow;
  
  // If not found, try to construct from agents array
  if (!agentWorkflow && contentType.prompting?.agents) {
    const agents = contentType.prompting.agents;
    if (Array.isArray(agents) && agents.length > 0) {
      const firstAgent = agents[0];
      if (typeof firstAgent === 'object' && firstAgent.id) {
        // Array of agent objects
        agentWorkflow = {
          agents: agents,
          executionOrder: 'sequential' as const,
        };
      } else if (typeof firstAgent === 'string') {
        // Array of agent names - create minimal structure
        agentWorkflow = {
          agents: (agents as string[]).map((agentName: string, idx: number) => ({
            id: `agent-${idx + 1}`,
            name: agentName,
            role: agentName.toLowerCase().replace(/\s+/g, '_'),
            order: idx + 1,
          })),
          executionOrder: 'sequential' as const,
        };
      }
    }
  }
  
  if (agentWorkflow && agentWorkflow.agents && agentWorkflow.agents.length > 0) {
    return agentWorkflow as AgentWorkflow;
  }
  
  return null;
}

export async function generateContent(
  input: GenerateContentInput
): Promise<{ 
  scenes: any[]; 
  textOverlaySuggestions: string[]; 
  thumbnailPrompt: string;
  generationContext?: {
    inputs: ContentCreationRequest['inputs'];
    contentTypeName: string;
    systemPrompt: string;
  };
}> {
  const { contentType, inputs } = input;

  // Reset global memory for new generation session
  resetGlobalMemory();

  // Check if agent workflow exists - multi-agent generation is required
  const agentWorkflow = getAgentWorkflow(contentType);
  
  if (!agentWorkflow) {
    throw new Error(
      `No agents configured for content type "${contentType.name}". ` +
      `Please configure agents in the workflow editor before generating content.`
    );
  }

  // Step 1: Extract dynamic inputs based on contentType.inputsContract.fields
  const dynamicInputs = extractDynamicInputs(contentType, inputs);

  // Step 2 & 3: Generate scenes using dynamic agentic framework
  const result = await generateScenesDynamically(contentType, agentWorkflow, dynamicInputs);
  const allScenes = result.scenes;

  // Convert scenes to format with generation context
  const scenes = allScenes.map((scene: any, idx: number) => {
    const agentContributions = scene.agentContributions || [];

    return {
      ...scene,
      // Add generation context
      generationContext: {
        inputs,
        contentTypeName: contentType.name,
        systemPrompt: contentType.prompting.systemPromptTemplate,
        userPromptContext: dynamicInputs,
        scenePurpose: scene.purpose,
        sceneSpecificContext: {
          purpose: scene.purpose,
          camera: scene.camera,
          environment: scene.environment,
          onScreenText: scene.onScreenText,
        },
      },
    };
  });

  return {
    scenes,
    textOverlaySuggestions: [],
    thumbnailPrompt: 'Thumbnail for the content',
    generationContext: {
      inputs,
      contentTypeName: contentType.name,
      systemPrompt: contentType.prompting.systemPromptTemplate,
    },
  };
}
