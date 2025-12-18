import { AgentWorkflow } from '../agents';
import { SceneInfo } from './sceneDictionary';
import { executeAgentWithSharedState } from './agentExecutor';

export interface SceneWorkflowInput {
  productName: string;
  productLink?: string;
  offer?: string;
  features?: string[];
  targetAudience?: string;
  platform?: string;
}

export interface AgentContribution {
  agentId: string;
  agentName: string;
  agentRole: string;
  order: number;
  input: Record<string, any>;
  output: Record<string, any>;
}

export interface SceneWorkflowResult {
  scene: any;
  agentContributions: AgentContribution[];
}

/**
 * Runs the agent workflow for a single scene
 * Agents execute sequentially, each receiving previous agent's output
 */
export async function runAgentWorkflowForScene(
  sceneInfo: SceneInfo,
  agentWorkflow: AgentWorkflow,
  input: SceneWorkflowInput,
  templateConfig: any,
  limits: any,
  cameraPresets: string[],
  shotLibrary: any[],
  constraints: string[],
  isImageFirst: boolean
): Promise<SceneWorkflowResult> {
  // Sort agents by order
  const sortedAgents = [...agentWorkflow.agents].sort((a, b) => a.order - b.order);

  // Initialize shared state for this scene
  const sharedState: Record<string, any> = {
    input: {
      ...input,
      sceneIndex: sceneInfo.index,
      scenePurpose: sceneInfo.purpose,
      executionInput: sceneInfo.execution_input,
      templateOutput: {
        sceneCount: 1,
        minSceneSeconds: templateConfig.output.minSceneSeconds,
        maxSceneSeconds: templateConfig.output.maxSceneSeconds,
        aspectRatio: templateConfig.output.aspectRatio,
        style: templateConfig.output.style,
      },
      shotLibrary,
      constraints,
      cameraPresets,
      limits,
    },
  };

  // Track agent contributions for this scene
  const agentContributions: AgentContribution[] = [];

  // Execute agents sequentially - each agent receives previous agent's response
  const isLastAgent = (idx: number) => idx === sortedAgents.length - 1;
  
  for (let idx = 0; idx < sortedAgents.length; idx++) {
    const agent = sortedAgents[idx];
    const isFinal = isLastAgent(idx);
    
    // Build visible state - include previous agent outputs
    const visibleState: Record<string, any> = {
      ...sharedState.input,
    };

    // Add all previous agent outputs to visible state
    agentContributions.forEach(contrib => {
      visibleState[contrib.agentId] = contrib.output;
    });

    // Execute agent with scene purpose and all context
    const agentOutput = await executeAgentWithSharedState({
      agent,
      visibleState,
      limits,
      cameraPresets,
      shotLibrary,
      scenePurpose: sceneInfo.purpose,
      isFinalAgent: isFinal,
    });

    // Track this agent's contribution
    agentContributions.push({
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      order: agent.order,
      input: { ...visibleState },
      output: { ...agentOutput },
    });

    // Store output in shared state for next agent
    sharedState[agent.id] = agentOutput;
  }

  // Extract final output from the last agent
  const finalAgent = sortedAgents[sortedAgents.length - 1];
  const finalOutput = sharedState[finalAgent.id] || {};

  // Extract imagePrompt from final agent output
  let imagePrompt = '';
  
  if (finalOutput.imagePrompt) {
    imagePrompt = finalOutput.imagePrompt;
  } else {
    throw new Error(`Final agent ${finalAgent.name} (${finalAgent.role}) output missing required 'imagePrompt' field`);
  }

  // Build the scene from final output
  const scene = {
    id: `scene-${sceneInfo.index}`,
    index: sceneInfo.index,
    purpose: sceneInfo.purpose,
    imagePrompt: imagePrompt || `Image prompt for ${sceneInfo.purpose} scene`,
    negativePrompt: finalOutput.negativePrompt || '',
    camera: typeof finalOutput.camera === 'string'
      ? { shot: finalOutput.camera }
      : (finalOutput.camera && typeof finalOutput.camera === 'object' ? finalOutput.camera : {}),
    environment: finalOutput.environment && typeof finalOutput.environment === 'object' ? finalOutput.environment : {},
    onScreenText: typeof finalOutput.onScreenText === 'string'
      ? { text: finalOutput.onScreenText }
      : (finalOutput.onScreenText && typeof finalOutput.onScreenText === 'object' ? finalOutput.onScreenText : {}),
    compositionNotes: finalOutput.compositionNotes || finalOutput.notes || '',
  };

  return { scene, agentContributions };
}
