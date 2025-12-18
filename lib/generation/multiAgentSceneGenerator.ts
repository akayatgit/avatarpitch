import { AgentWorkflow } from '../agents';
import { GeneratedOutputSchema } from '../schemas';
import { getSceneDictionary, SceneDictionaryInput, SceneGenerationPolicy } from './sceneDictionary';
import { runAgentWorkflowForScene, SceneWorkflowInput } from './sceneWorkflow';

/**
 * Template configuration interface
 */
export interface TemplateConfig {
  version: number;
  output: {
    sceneCount: number;
    minSceneSeconds: number;
    maxSceneSeconds: number;
    aspectRatio: string;
    style: string;
    renderTarget?: string;
    limits?: any;
    cameraPresets?: string[];
  };
  workflow: {
    systemPrompt: string;
    agentWorkflow?: AgentWorkflow;
    constraints?: string[];
  };
}

/**
 * Input for generating scenes with agents
 */
export interface GenerateScenesInput {
  templateConfig: TemplateConfig;
  productName: string;
  productLink?: string;
  offer?: string;
  features?: string[];
  targetAudience?: string;
  platform?: 'TikTok' | 'Reels' | 'Shorts';
}

/**
 * Main orchestrator function for multi-agent scene generation
 * 
 * Flow:
 * 1. Get scene dictionary (count + purposes) from LLM
 * 2. For each scene, run agent workflow sequentially
 * 3. Validate and return scenes with agent contributions
 */
export async function generateScenesWithAgents(
  input: GenerateScenesInput
): Promise<{ scenes: any[]; renderingSpec: any }> {
  const { templateConfig, productName, productLink, offer, features, targetAudience, platform } = input;
  
  const renderTarget = templateConfig.output.renderTarget || 'video';
  const isImageFirst = renderTarget === 'image_first_frame';
  
  // Set defaults
  const limits = templateConfig.output.limits || {
    imagePromptMaxChars: 1000,
    cameraMaxChars: 90,
    negativesMaxChars: 160,
    maxSentencesImagePrompt: 20,
    maxWordsOnScreenText: 6,
  };
  
  const cameraPresets = templateConfig.output.cameraPresets || [
    'CU handheld face',
    'MS handheld',
    'WS establishing',
    'Top-down product',
    'Product macro',
    'Over-shoulder phone',
    'Mirror shot',
    'Shelf product hero',
    'Lifestyle walk-by',
    'Flatlay'
  ];

  // Validate agent workflow exists
  const workflow = templateConfig.workflow as any;
  const hasAgentWorkflow = workflow.agentWorkflow;

  if (!hasAgentWorkflow) {
    throw new Error('Agent workflow not configured. Please use workflow editor to configure agents.');
  }

  const agentWorkflow: AgentWorkflow = workflow.agentWorkflow;
  const shotLibrary = workflow.shotLibrary || workflow.sceneBlueprint || [];
  const constraints = workflow.constraints || [];
  
  // Add image-first constraints if needed
  if (isImageFirst) {
    constraints.push(
      'Output is IMAGE prompts for the FIRST FRAME only (no motion/editing instructions)',
      'Never use headings (###), Objective, Key Elements, Recommendations, or bullet lists in any field.',
      'imagePrompt must be renderer-ready, not an explanation.'
    );
  }

  // STEP 1: Get scene dictionary (count + purposes) from LLM
  const sceneDictionaryInput: SceneDictionaryInput = {
    productName,
    productLink,
    offer,
    features,
    targetAudience,
    platform,
  };

  const sceneGenerationPolicy: SceneGenerationPolicy = {
    minScenes: templateConfig.output.sceneCount || 3,
    maxScenes: templateConfig.output.sceneCount || 8,
  };

  const sceneDictionary = await getSceneDictionary(
    sceneDictionaryInput,
    sceneGenerationPolicy,
    shotLibrary,
    templateConfig.workflow.systemPrompt
  );

  const sceneCount = sceneDictionary.sceneCount;
  const scenePurposes = sceneDictionary.scenes;

  // STEP 2: For each scene, run the agent workflow with that scene's purpose
  const allScenes: any[] = [];
  const sceneWorkflowInput: SceneWorkflowInput = {
    productName,
    productLink,
    offer,
    features,
    targetAudience,
    platform,
  };

  for (const sceneInfo of scenePurposes) {
    const { scene, agentContributions } = await runAgentWorkflowForScene(
      sceneInfo,
      agentWorkflow,
      sceneWorkflowInput,
      templateConfig,
      limits,
      cameraPresets,
      shotLibrary,
      constraints,
      isImageFirst
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

  // Build rendering spec
  const renderingSpec = {
    aspectRatio: templateConfig.output.aspectRatio,
    style: templateConfig.output.style,
    imageModelHint: 'default',
    colorGrade: 'default',
    lightingMood: 'default',
    musicMood: 'default',
    transitions: 'default',
  };

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
      renderingSpec,
    };
    
    return validated;
  } catch (error) {
    // Return anyway with agent contributions
    return {
      scenes: allScenes,
      renderingSpec,
    };
  }
}
