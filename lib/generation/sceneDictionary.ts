import { ChatOpenAI } from '@langchain/openai';
import { SCENE_DICTIONARY_SYSTEM_PROMPT, getSceneDictionaryUserPrompt } from './promptLibrary';

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

export interface SceneDictionaryInput {
  productName: string;
  productLink?: string;
  offer?: string;
  features?: string[];
  targetAudience?: string;
  platform?: string;
}

export interface SceneGenerationPolicy {
  minScenes: number;
  maxScenes: number;
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
 * First LLM call: Determines scene count and purposes
 * This is the planning phase before generating prompts for each scene
 */
export async function getSceneDictionary(
  input: SceneDictionaryInput,
  sceneGenerationPolicy: SceneGenerationPolicy,
  shotLibrary: any[],
  contentTypeSystemPrompt?: string
): Promise<SceneDictionaryResult> {
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: 0.7,
    openAIApiKey: getApiKey(),
  });

  const availablePurposes = shotLibrary.map(s => s.type || s.purpose);
  const userPrompt = getSceneDictionaryUserPrompt(input, sceneGenerationPolicy, availablePurposes);

  // Concatenate content type system prompt to the base system prompt
  const systemPrompt = contentTypeSystemPrompt 
    ? `${SCENE_DICTIONARY_SYSTEM_PROMPT}\n\n${contentTypeSystemPrompt}`
    : SCENE_DICTIONARY_SYSTEM_PROMPT;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  let content: string;
  if (typeof response.content === 'string') {
    content = response.content;
  } else {
    content = String(response.content);
  }

  content = content.trim();
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse scene dictionary from LLM response');
    }
  }

  return {
    sceneCount: parsed.sceneCount || sceneGenerationPolicy.minScenes,
    scenes: parsed.scenes || [],
  };
}
