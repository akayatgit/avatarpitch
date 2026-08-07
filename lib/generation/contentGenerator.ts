import { ContentTypeDefinition, ContentCreationRequest } from '../schemas';
import { resolveAgentWorkflow } from '../agents';
import { extractDynamicInputs } from './dynamicInputExtractor';
import { resetGlobalMemory } from './agenticFramework';
import { generateScenesDynamically } from './dynamicMultiAgentSceneGenerator';
import { generateFixedCarouselScenes } from './fixedCarouselGenerator';

interface GenerateContentInput {
  contentType: ContentTypeDefinition;
  inputs: ContentCreationRequest['inputs'];
}

export async function generateContent(
  input: GenerateContentInput
): Promise<{ 
  scenes: any[]; 
  textOverlaySuggestions: string[]; 
  thumbnailPrompt: string;
  caption?: string;
  sceneReferenceImageUrls?: Record<string, string[]>;
  generationContext?: {
    inputs: ContentCreationRequest['inputs'];
    contentTypeName: string;
    systemPrompt: string;
  };
}> {
  const { contentType, inputs } = input;

  // Reset global memory for new generation session
  resetGlobalMemory();

  // Step 1: Extract dynamic inputs based on contentType.inputsContract.fields
  const dynamicInputs = extractDynamicInputs(contentType, inputs);

  // Fixed-carousel content types skip the LLM scene planner and the multi-agent
  // "argue and rewrite" pipeline entirely — scene count/layout is deterministic.
  if (contentType.sceneGenerationPolicy?.mode === 'fixed_carousel') {
    const fixedResult = await generateFixedCarouselScenes(contentType, dynamicInputs);
    return {
      scenes: fixedResult.scenes,
      textOverlaySuggestions: [],
      thumbnailPrompt: 'Thumbnail for the content',
      caption: fixedResult.caption,
      sceneReferenceImageUrls: fixedResult.sceneReferenceImageUrls,
      generationContext: {
        inputs,
        contentTypeName: contentType.name,
        systemPrompt: contentType.prompting.systemPromptTemplate,
      },
    };
  }

  // Resolve workflow from content type, or fall back to seeded DB agents
  const agentWorkflow = await resolveAgentWorkflow(contentType);

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
