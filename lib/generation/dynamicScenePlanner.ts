import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ContentTypeDefinition } from '../schemas';
import { getGlobalMemory } from './agenticFramework';

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  return apiKey;
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export interface SceneInfo {
  index: number;
  purpose: string;
  execution_input?: string;
}

export interface SceneDictionaryResult {
  sceneCount: number;
  scenes: SceneInfo[];
}

/**
 * Dynamic scene planning using agentic framework
 * Uses contentType system prompt + dynamic inputs to generate scene purposes
 * No fixed schemas or templates - everything is dynamic
 */
export async function planScenesDynamically(
  contentType: ContentTypeDefinition,
  dynamicInputs: Record<string, any>
): Promise<SceneDictionaryResult> {
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: 0.7,
    openAIApiKey: getApiKey(),
  });

  const memory = getGlobalMemory();

  // Build dynamic system prompt from contentType
  const systemPrompt = contentType.prompting?.systemPromptTemplate || '';

  // Build dynamic user prompt based on available inputs and scene generation policy
  const inputsText = Object.entries(dynamicInputs)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  const minScenes = contentType.sceneGenerationPolicy.minScenes;
  const maxScenes = contentType.sceneGenerationPolicy.maxScenes;
  
  const sceneRules = contentType.sceneGenerationPolicy.rules || {};
  const rulesText = [
    sceneRules.mustStartStrong ? 'First scene must start strong (hook-like opening)' : null,
    sceneRules.mustEndWithClosure ? 'Last scene must end with closure (CTA, payoff, conclusion)' : null,
    sceneRules.avoidRepetition ? 'Avoid repetition in purpose, shot, or location' : null,
    sceneRules.platformAwareOrdering ? 'Order scenes appropriately for the platform' : null,
  ].filter(Boolean).join('\n');

  // Get shot library if available from workflow
  // Note: shotLibrary and sceneBlueprint are optional properties not in the schema but may exist at runtime
  const agentWorkflow = contentType.prompting?.agentWorkflow as any;
  const shotLibrary = agentWorkflow?.shotLibrary || agentWorkflow?.sceneBlueprint || [];
  const availablePurposes = shotLibrary.length > 0 
    ? shotLibrary.map((s: any) => s.type || s.purpose).join(', ')
    : '';

  const userPrompt = `You are planning scenes for content generation.

CRITICAL: All scene purposes MUST strictly align with and respect the system prompt requirements provided above. Do not create scene purposes that contradict the system prompt constraints. If the system prompt specifies requirements for specific scenes (e.g., "Scene 1: pure white background"), those requirements MUST be reflected in the scene purpose.

Available inputs:
${inputsText}

Scene generation requirements:
- Minimum scenes: ${minScenes}
- Maximum scenes: ${maxScenes}
${rulesText ? `\nRules:\n${rulesText}` : ''}
${availablePurposes ? `\nAvailable scene purposes/types: ${availablePurposes}` : ''}

Your task:
1. Review the system prompt above carefully to understand ALL constraints and requirements for each scene
2. Determine the appropriate number of scenes (between ${minScenes} and ${maxScenes})
3. Define the purpose of each scene that STRICTLY ADHERES to the system prompt requirements
4. Ensure scenes create a logical flow and narrative while respecting all system prompt constraints
5. If Scene 1 has specific requirements (e.g., "pure white background", "85% frame fill", "no props"), ensure the scene purpose explicitly reflects those requirements
6. For subsequent scenes, ensure their purposes align with any scene-specific requirements mentioned in the system prompt

Output format: Plain text list of scenes, one per line, in this format:
Scene 1: <purpose that aligns with system prompt>
Scene 2: <purpose that aligns with system prompt>
...

Output ONLY the scene list as plain text. No JSON, no formatting, no titles. Just the scenes.`;

  // Create prompt template with memory
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ...memory.chatHistory,
    ['human', userPrompt],
  ]);

  const chain = prompt.pipe(llm);

  // Invoke chain
  const response = await chain.invoke({});

  let content: string;
  if (typeof response.content === 'string') {
    content = response.content;
  } else {
    content = String(response.content);
  }

  // Clean content - remove markdown code blocks if present
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```$/, '');
  }
  content = content.trim();

  // Parse plain text scene list
  // Format: "Scene 1: <purpose>\nScene 2: <purpose>..."
  const sceneLines = content.split('\n').filter(line => line.trim().length > 0);
  const scenes: SceneInfo[] = [];
  
  for (let i = 0; i < sceneLines.length; i++) {
    const line = sceneLines[i].trim();
    // Extract scene purpose (remove "Scene X:" prefix if present)
    const purposeMatch = line.match(/Scene\s+\d+:\s*(.+)/i) || line.match(/^\d+\.\s*(.+)/) || [null, line];
    const purpose = purposeMatch[1]?.trim() || line;
    
    if (purpose) {
      scenes.push({
        index: i + 1,
        purpose: purpose,
      });
    }
  }

  // Ensure we have at least minScenes
  if (scenes.length < minScenes) {
    for (let i = scenes.length; i < minScenes; i++) {
      scenes.push({
        index: i + 1,
        purpose: `Scene ${i + 1}`,
      });
    }
  }

  // Limit to maxScenes
  const finalScenes = scenes.slice(0, Math.min(maxScenes, scenes.length));

  // Save to memory
  memory.chatHistory.push(new HumanMessage(userPrompt));
  memory.chatHistory.push(new AIMessage(content));

  return {
    sceneCount: finalScenes.length,
    scenes: finalScenes,
  };
}
