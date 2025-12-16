import { ChatOpenAI } from '@langchain/openai';
import { GeneratedProjectSchema, TemplateConfig } from './schemas';
import { generateScenesWithAgents } from './multiAgentSceneGenerator';

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Please add it to your .env.local file.');
  }
  return apiKey;
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function createLLM() {
  return new ChatOpenAI({
    modelName: getModel(),
    temperature: 0.7,
    openAIApiKey: getApiKey(),
  });
}

interface GenerateScenesInput {
  templateConfig: TemplateConfig;
  productName: string;
  productLink?: string;
  offer: string;
  features?: string[];
  targetAudience?: string;
  platform: 'TikTok' | 'Reels' | 'Shorts';
}

export async function generateScenes(
  input: GenerateScenesInput
): Promise<{ scenes: any[]; renderingSpec: any }> {
  const { templateConfig } = input;

  // Check if template uses agent workflow
  const workflow = templateConfig.workflow as any;
  if (workflow.agentWorkflow) {
    // Use multi-agent generation
    return generateScenesWithAgents(input);
  }

  // Legacy single-agent generation (fallback)
  const { productName, productLink, offer, features, targetAudience, platform } = input;

  const sceneCount = templateConfig.output.sceneCount;
  const minSeconds = templateConfig.output.minSceneSeconds ?? 3;
  const maxSeconds = templateConfig.output.maxSceneSeconds ?? 7;

  const featuresText = features && features.length > 0 ? features.join(', ') : 'Not specified';
  const audienceText = targetAudience || 'General audience';
  const linkText = productLink || 'Not provided';

  // Extract sceneBlueprint with proper type handling
  const sceneBlueprint = ('sceneBlueprint' in templateConfig.workflow && templateConfig.workflow.sceneBlueprint && Array.isArray(templateConfig.workflow.sceneBlueprint))
    ? templateConfig.workflow.sceneBlueprint
    : [];
  
  const sceneBlueprintText = sceneBlueprint
    .map((s: any, i: number) => `${i + 1}. ${s.type.toUpperCase()}: ${'goal' in s ? s.goal : 'Create engaging content'}`)
    .join('\n');
  
  const constraints = ('constraints' in templateConfig.workflow && Array.isArray(templateConfig.workflow.constraints))
    ? templateConfig.workflow.constraints
    : [];
  
  const constraintsText = constraints.map((c: string) => `- ${c}`).join('\n');
  
  const systemPrompt = ('systemPrompt' in templateConfig.workflow && typeof templateConfig.workflow.systemPrompt === 'string')
    ? templateConfig.workflow.systemPrompt
    : 'Generate engaging video content';
  
  const firstSceneType = sceneBlueprint.length > 0 && sceneBlueprint[0] ? (sceneBlueprint[0] as any).type : 'hook';
  const sceneTypes = sceneBlueprint.length > 0 
    ? sceneBlueprint.map((s: any) => s.type).join(', ')
    : 'hook, problem, solution, proof, cta';

  const prompt = `You are a video script generator. Generate a ${sceneCount}-scene video script based on the following:

PRODUCT: ${productName}
PRODUCT LINK: ${linkText}
OFFER: ${offer}
FEATURES: ${featuresText}
TARGET AUDIENCE: ${audienceText}
PLATFORM: ${platform}

TEMPLATE CONFIG:
- Style: ${templateConfig.output.style}
- Aspect Ratio: ${templateConfig.output.aspectRatio}
- Scene Count: ${sceneCount}
- Scene Duration Range: ${minSeconds}-${maxSeconds} seconds per scene

SYSTEM PROMPT: ${systemPrompt}

SCENE BLUEPRINT:
${sceneBlueprintText}

CONSTRAINTS:
${constraintsText}

Generate a JSON response with this EXACT structure:
{
  "scenes": [
    {
      "index": 1,
      "shotType": "${firstSceneType}",
      "durationSeconds": <number between ${minSeconds} and ${maxSeconds}>,
      "imagePrompt": "<detailed visual description for this scene>",
      "camera": "<camera angle/movement description>",
      "negativePrompt": "<what to avoid in the image>",
      "onScreenText": "<optional text overlay>",
      "notes": "<optional production notes>"
    },
    ... (exactly ${sceneCount} scenes)
  ],
  "renderingSpec": {
    "aspectRatio": "${templateConfig.output.aspectRatio}",
    "style": "${templateConfig.output.style}",
    "musicMood": "<mood description for background music>",
    "transitions": "<transition style between scenes>"
  }
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Ensure:
- Exactly ${sceneCount} scenes
- Each scene MUST have: index (1-${sceneCount}), shotType (use sceneBlueprint types: ${sceneTypes}), imagePrompt (detailed visual description), camera, and durationSeconds (${minSeconds}-${maxSeconds})
- Scene 1 shotType MUST be "${firstSceneType}"
- All durations are integers
- Total video length should be reasonable for ${platform}`;

  let attempts = 0;
  const maxAttempts = 2;

  const llm = createLLM();
  
  while (attempts < maxAttempts) {
    try {
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : String(response.content);

      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);
      
      // Transform legacy format to new schema format
      const transformed = {
        scenes: parsed.scenes.map((scene: any, idx: number) => {
          // Convert visualPrompt to imagePrompt
          let imagePrompt = scene.imagePrompt || scene.visualPrompt || '';
          
          // Ensure shotType exists - use sceneBlueprint if available
          let shotType = scene.shotType;
          if (!shotType) {
            if (sceneBlueprint.length > 0 && sceneBlueprint[idx]) {
              shotType = (sceneBlueprint[idx] as any).type || (idx === 0 ? 'hook' : 'general');
            } else {
              shotType = idx === 0 ? 'hook' : 'general';
            }
          }
          
          // If imagePrompt is still empty, generate a default based on shotType
          if (!imagePrompt || imagePrompt.trim().length === 0) {
            const goal = sceneBlueprint.length > 0 && sceneBlueprint[idx] ? (sceneBlueprint[idx] as any).goal : 'Show product';
            imagePrompt = `${goal} scene with clear composition and good lighting`;
          }
          
          // Ensure camera exists
          const camera = scene.camera || 'CU handheld face';
          
          return {
            index: scene.index || idx + 1,
            shotType: shotType,
            camera: camera,
            imagePrompt: imagePrompt,
            negativePrompt: scene.negativePrompt || '',
            onScreenText: scene.onScreenText || '',
            notes: scene.notes || '',
            durationSeconds: scene.durationSeconds,
          };
        }),
        renderingSpec: parsed.renderingSpec || {
          aspectRatio: templateConfig.output.aspectRatio,
          style: templateConfig.output.style,
        },
      };
      
      const validated = GeneratedProjectSchema.parse(transformed);

      // Additional validation: scene count and durations
      if (validated.scenes.length !== sceneCount) {
        throw new Error(`Expected ${sceneCount} scenes, got ${validated.scenes.length}`);
      }

      for (const scene of validated.scenes) {
        if (scene.durationSeconds && (scene.durationSeconds < minSeconds || scene.durationSeconds > maxSeconds)) {
          throw new Error(
            `Scene ${scene.index} duration ${scene.durationSeconds}s is outside range ${minSeconds}-${maxSeconds}s`
          );
        }
        if (!scene.imagePrompt || !scene.camera) {
          throw new Error(`Scene ${scene.index} missing required fields: imagePrompt or camera`);
        }
      }

      return validated;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to generate valid scenes after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Retry with a more explicit prompt
      console.warn(`Attempt ${attempts} failed, retrying...`, error);
    }
  }

  throw new Error('Unexpected error in generateScenes');
}

