import { AgentWorkflow } from '../agents';
import { ContentTypeDefinition } from '../schemas';
import { SceneInfo } from './dynamicScenePlanner';
import { executeReActAgent, AgentArgumentationOutput, FinalAgentOutput } from './agenticFramework';

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
 * Runs agent workflow for a single scene using agentic framework
 * Agents collaborate through argumentation and prompt modification
 * Uses global shared memory for consistency across scenes
 */
export async function runDynamicAgentWorkflowForScene(
  sceneInfo: SceneInfo,
  agentWorkflow: AgentWorkflow,
  contentType: ContentTypeDefinition,
  dynamicInputs: Record<string, any>
): Promise<SceneWorkflowResult> {
  // Sort agents by order
  const sortedAgents = [...agentWorkflow.agents].sort((a, b) => a.order - b.order);

  if (sortedAgents.length === 0) {
    throw new Error('No agents configured in workflow');
  }

  // Track agent contributions
  const agentContributions: AgentContribution[] = [];
  
  // Current prompt being refined by agents (starts as null for first agent)
  let currentPrompt: string | null = null;

  // Execute agents sequentially - each agent argues and modifies the prompt
  const isLastAgent = (idx: number) => idx === sortedAgents.length - 1;
  
  for (let idx = 0; idx < sortedAgents.length; idx++) {
    const agent = sortedAgents[idx];
    const isFinal = isLastAgent(idx);
    
    // Execute agent with agentic framework
    const agentResult = await executeReActAgent(
      agent,
      contentType,
      currentPrompt,
      dynamicInputs,
      {
        sceneIndex: sceneInfo.index,
        scenePurpose: sceneInfo.purpose,
        isFinalAgent: isFinal,
      }
    );

    // Track this agent's contribution
    if (isFinal) {
      // Final agent produces scene output
      const finalOutput = agentResult as FinalAgentOutput;
      
      agentContributions.push({
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        order: agent.order,
        input: {
          previousPrompt: currentPrompt,
          dynamicInputs,
          sceneContext: {
            sceneIndex: sceneInfo.index,
            scenePurpose: sceneInfo.purpose,
          },
        },
        output: finalOutput,
      });

      // Build the scene from final output (plain text prompt only)
      const scene = {
        id: `scene-${sceneInfo.index}`,
        index: sceneInfo.index,
        purpose: sceneInfo.purpose,
        imagePrompt: finalOutput.imagePrompt, // Plain text prompt only
        negativePrompt: '',
        camera: {},
        environment: {},
        onScreenText: {},
        compositionNotes: '',
      };

      return { scene, agentContributions };
    } else {
      // Regular agent produces argumentation and modified prompt
      const argumentation = agentResult as AgentArgumentationOutput;
      
      agentContributions.push({
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        order: agent.order,
        input: {
          previousPrompt: currentPrompt,
          dynamicInputs,
          sceneContext: {
            sceneIndex: sceneInfo.index,
            scenePurpose: sceneInfo.purpose,
          },
        },
        output: argumentation,
      });

      // Update current prompt for next agent
      currentPrompt = argumentation.modified_prompt;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('No final agent found in workflow');
}

