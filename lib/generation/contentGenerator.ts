import { ChatOpenAI } from '@langchain/openai';
import { ContentTypeDefinition, ContentCreationRequest } from '../schemas';
import { generateScenesWithAgents } from './multiAgentSceneGenerator';
import { AgentWorkflow, AgentDefinition } from '../agents';
import { getSinglePromptGenerationUserPrompt } from './promptLibrary';

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return key;
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

interface GenerateContentInput {
  contentType: ContentTypeDefinition;
  inputs: ContentCreationRequest['inputs'];
}

// Convert ContentCreationRequest inputs to format expected by multi-agent generator
function convertInputsToLegacyFormat(inputs: ContentCreationRequest['inputs']) {
  const subjectName = inputs.subject?.name || 'Unknown';
  const subjectType = inputs.subject?.type || 'product';
  
  // Extract product info
  let productName = subjectName;
  let productLink: string | undefined;
  let offer: string | undefined;
  let features: string[] | undefined;
  let targetAudience: string | undefined;
  let platform: 'TikTok' | 'Reels' | 'Shorts' | undefined;

  if (subjectType === 'product' && inputs.subject?.product) {
    const product = inputs.subject.product;
    features = product.keyPoints;
  }

  if (inputs.offer?.text) {
    offer = inputs.offer.text;
  }

  if (inputs.audience?.description) {
    targetAudience = inputs.audience.description;
  }

  // Map platform
  const platformMap: Record<string, 'TikTok' | 'Reels' | 'Shorts'> = {
    'tiktok': 'TikTok',
    'reels': 'Reels',
    'shorts': 'Shorts',
  };
  platform = platformMap[inputs.platform] || 'TikTok';

  return {
    productName,
    productLink,
    offer,
    features,
    targetAudience,
    platform,
  };
}

// Convert ContentTypeDefinition to TemplateConfig format for multi-agent generator
function convertContentTypeToTemplateConfig(contentType: ContentTypeDefinition) {
  // Get agentWorkflow - check both agentWorkflow field and agents array
  let agentWorkflow: any = contentType.prompting?.agentWorkflow;
  
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
        // Array of agent names - need to fetch from database or create minimal structure
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
  
  return {
    version: 1,
    output: {
      sceneCount: contentType.sceneGenerationPolicy.maxScenes,
      minSceneSeconds: contentType.outputContract.globalDefaults.durationPerSceneSeconds,
      maxSceneSeconds: contentType.outputContract.globalDefaults.durationPerSceneSeconds,
      aspectRatio: contentType.outputContract.globalDefaults.defaultAspectRatio,
      style: contentType.outputContract.globalDefaults.visualStylePreset,
      renderTarget: 'image_first_frame' as const,
      limits: {
        imagePromptMaxChars: 500,
        cameraMaxChars: 90,
        negativesMaxChars: 160,
        maxSentencesImagePrompt: 10,
        maxWordsOnScreenText: 6,
      },
      cameraPresets: [
        'CU handheld face',
        'MS handheld',
        'WS establishing',
        'Top-down product',
        'Product macro',
      ],
    },
    workflow: {
      systemPrompt: contentType.prompting.systemPromptTemplate,
      agentWorkflow: agentWorkflow || {
        agents: [],
        executionOrder: 'sequential' as const,
      },
      constraints: [],
    },
  };
}

async function generateContentWithAgents(
  input: GenerateContentInput
): Promise<{ 
  scenes: any[]; 
  textOverlaySuggestions: string[]; 
  thumbnailPrompt: string;
  generationContext?: any;
}> {
  const { contentType, inputs } = input;

  // Convert to legacy format
  const legacyInputs = convertInputsToLegacyFormat(inputs);
  const templateConfig = convertContentTypeToTemplateConfig(contentType);

  // Use multi-agent generator
  const result = await generateScenesWithAgents({
    templateConfig: templateConfig as any,
    productName: legacyInputs.productName,
    productLink: legacyInputs.productLink,
    offer: legacyInputs.offer,
    features: legacyInputs.features,
    targetAudience: legacyInputs.targetAudience,
    platform: legacyInputs.platform,
  });

  // Convert scenes to new format (storyboard_v1)
  const scenes = result.scenes.map((scene: any, idx: number) => {
    // Preserve agent contributions if they exist
    const agentContributions = scene.agentContributions || [];
    const finalAssembler = scene.finalAssembler;

    // Convert to new format
    return {
      id: scene.id || `scene-${idx + 1}`,
      index: scene.index || (idx + 1),
      purpose: scene.shotType || scene.purpose || `Scene ${idx + 1} purpose`,
      imagePrompt: scene.imagePrompt || '',
      negativePrompt: scene.negativePrompt || '',
      camera: typeof scene.camera === 'string' 
        ? { shot: scene.camera }
        : scene.camera || {},
      environment: scene.environment || {},
      onScreenText: typeof scene.onScreenText === 'string'
        ? { text: scene.onScreenText }
        : scene.onScreenText || {},
      compositionNotes: scene.notes || scene.compositionNotes || '',
      // Preserve agent contributions for breakdown dialog
      agentContributions,
      finalAssembler,
      // Add generation context
      generationContext: {
        inputs,
        contentTypeName: contentType.name,
        systemPrompt: contentType.prompting.systemPromptTemplate,
        userPromptContext: {
          goal: inputs.goal,
          platform: inputs.platform,
          language: inputs.language,
          tone: inputs.tone?.join(', '),
          subjectName: inputs.subject?.name,
          subjectType: inputs.subject?.type,
          offerText: inputs.offer?.text,
          audienceDesc: inputs.audience?.description,
        },
        scenePurpose: scene.shotType || scene.purpose,
        sceneSpecificContext: {
          purpose: scene.shotType || scene.purpose,
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

  // Check if content type has agent workflow
  // agentWorkflow can be stored in prompting.agentWorkflow (from API) or we need to construct it
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
      }
    }
  }
  
  const hasAgents = agentWorkflow && agentWorkflow.agents && agentWorkflow.agents.length > 0;

  // If agents are configured, use multi-agent generation
  if (hasAgents) {
    return await generateContentWithAgents(input);
  }

  // Otherwise, use single-prompt generation (fallback)
  const sceneCount = Math.floor(
    Math.random() * (contentType.sceneGenerationPolicy.maxScenes - contentType.sceneGenerationPolicy.minScenes + 1) +
    contentType.sceneGenerationPolicy.minScenes
  );

  const systemPrompt = contentType.prompting.systemPromptTemplate;
  
  // Build context from inputs
  const subjectName = inputs.subject?.name || 'Unknown';
  const subjectType = inputs.subject?.type || 'product';
  const goal = inputs.goal || 'sell';
  const platform = inputs.platform || 'tiktok';
  const language = inputs.language || contentType.outputContract.globalDefaults.defaultLanguage;
  const tone = inputs.tone?.join(', ') || '';
  const offerText = inputs.offer?.text || '';
  const audienceDesc = inputs.audience?.description || '';
  
  // Build product info if subject is a product
  let productInfo = '';
  if (subjectType === 'product' && inputs.subject?.product) {
    const product = inputs.subject.product;
    productInfo = `
Product Details:
- Category: ${product.category || 'Not specified'}
- Material: ${product.material || 'Not specified'}
- Fit: ${product.fit || 'Not specified'}
- Colors: ${product.colors?.join(', ') || 'Not specified'}
- Key Points: ${product.keyPoints?.join(', ') || 'Not specified'}
`;
  }

  // Build story info if subject is a story
  let storyInfo = '';
  if (subjectType === 'story' && inputs.subject?.story) {
    const story = inputs.subject.story;
    storyInfo = `
Story Details:
- Characters: ${story.characters?.join(', ') || 'Not specified'}
- Setting: ${story.setting || 'Not specified'}
- Theme: ${story.theme || 'Not specified'}
- Conflict: ${story.conflict || 'Not specified'}
`;
  }

  const userPrompt = getSinglePromptGenerationUserPrompt(
    sceneCount,
    goal,
    platform,
    language,
    tone,
    subjectType,
    subjectName,
    productInfo,
    storyInfo,
    offerText,
    audienceDesc,
    contentType
  );

  const model = new ChatOpenAI({
    modelName: getModel(),
    temperature: 0.7,
    openAIApiKey: getApiKey(),
  });

  try {
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (!response) {
      throw new Error('No response received from model');
    }

    // Handle response content - could be string or object
    let content: string;
    if (typeof response.content === 'string') {
      content = response.content;
    } else if (response.content) {
      content = String(response.content);
    } else {
      throw new Error('Empty response content from model');
    }
    
    // Clean up response - remove markdown code blocks if present
    content = content.trim();
    if (!content) {
      throw new Error('Empty content after trimming');
    }
    
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    if (!content) {
      throw new Error('Empty content after removing markdown');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Content: ${content.substring(0, 200)}`);
      }
    }
    
    // Validate and ensure all scenes have required fields
    const scenes = parsed.scenes.map((scene: any, idx: number) => ({
      id: scene.id || `scene-${idx + 1}`,
      index: idx + 1, // Add index for compatibility
      purpose: scene.purpose || `Scene ${idx + 1} purpose`,
      imagePrompt: scene.imagePrompt || `Image prompt for scene ${idx + 1}`,
      negativePrompt: scene.negativePrompt || '',
      camera: scene.camera || {},
      environment: scene.environment || {},
      characters: scene.characters || [],
      props: scene.props || [],
      onScreenText: scene.onScreenText || {},
      compositionNotes: scene.compositionNotes || '',
      // Add generation context
      generationContext: {
        inputs,
        contentTypeName: contentType.name,
        systemPrompt,
        userPromptContext: {
          goal,
          platform,
          language,
          tone,
          subjectName,
          subjectType,
          offerText,
          audienceDesc,
          productInfo: productInfo || undefined,
          storyInfo: storyInfo || undefined,
          sceneCount,
          rules: contentType.sceneGenerationPolicy.rules,
        },
        scenePurpose: scene.purpose,
        sceneSpecificContext: {
          purpose: scene.purpose,
          camera: scene.camera,
          environment: scene.environment,
          onScreenText: scene.onScreenText,
        },
      },
    }));

    return {
      scenes,
      textOverlaySuggestions: parsed.textOverlaySuggestions || [],
      thumbnailPrompt: parsed.thumbnailPrompt || 'Thumbnail for the content',
      generationContext: {
        inputs,
        contentTypeName: contentType.name,
        systemPrompt,
      },
    };
  } catch (error) {
    console.error('Error generating content:', error);
    throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
