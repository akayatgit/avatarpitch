import { AgentWorkflow } from '../agents';
import { GeneratedOutputSchema } from '../schemas';
import { ContentTypeDefinition } from '../schemas';
import { planScenesDynamically, SceneInfo } from './dynamicScenePlanner';
import { runDynamicAgentWorkflowForScene } from './dynamicSceneWorkflow';

/**
 * Main orchestrator function for dynamic multi-agent scene generation
 * 
 * Flow:
 * 1. Plan scenes dynamically using contentType system prompt + dynamic inputs
 * 2. For each scene, run agent workflow with agentic framework (global memory)
 * 3. Validate and return scenes with agent contributions
 */
export async function generateScenesDynamically(
  contentType: ContentTypeDefinition,
  agentWorkflow: AgentWorkflow,
  dynamicInputs: Record<string, any>
): Promise<{ scenes: any[] }> {
  // Validate agent workflow exists
  if (!agentWorkflow || !agentWorkflow.agents || agentWorkflow.agents.length === 0) {
    throw new Error(
      'Agent workflow not configured. Please configure agents in the workflow editor before generating scenes.'
    );
  }

  // STEP 1: Plan scenes dynamically (no fixed schema)
  const sceneDictionary = await planScenesDynamically(contentType, dynamicInputs);

  const sceneCount = sceneDictionary.sceneCount;
  const scenePurposes = sceneDictionary.scenes;

  // STEP 2: For each scene, run the agent workflow with agentic framework
  const allScenes: any[] = [];

  for (const sceneInfo of scenePurposes) {
    const { scene, agentContributions } = await runDynamicAgentWorkflowForScene(
      sceneInfo,
      agentWorkflow,
      contentType,
      dynamicInputs
    );

    // Attach agent contributions to the scene
    allScenes.push({
      ...scene,
      agentContributions: agentContributions.map(contrib => ({
        agentId: contrib.agentId,
        agentName: contrib.agentName,
        agentRole: contrib.agentRole,
        order: contrib.order,
        contribution: contrib.output,
        input: contrib.input,
      })),
    });
  }

  // Validate scenes
  try {
    const basicValidation = GeneratedOutputSchema.parse({
      format: 'storyboard_v1',
      scenes: allScenes.map(({ agentContributions, ...scene }) => scene),
    });

    const validated = {
      scenes: basicValidation.scenes.map((scene: any, idx: number) => ({
        ...scene,
        agentContributions: allScenes[idx].agentContributions,
      })),
    };
    
    return validated;
  } catch (error) {
    // Return anyway with agent contributions
    return {
      scenes: allScenes,
    };
  }
}

