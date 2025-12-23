import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { AgentDefinition } from '../agents';
import { ContentTypeDefinition } from '../schemas';

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

/**
 * Global shared memory across all scenes
 * This allows agents to reference previous scenes for consistency
 * Using a simple implementation compatible with LangChain v1.x
 */
interface GlobalMemory {
  chatHistory: BaseMessage[];
}

let globalMemory: GlobalMemory | null = null;

/**
 * Initialize or get global shared memory
 */
export function getGlobalMemory(): GlobalMemory {
  if (!globalMemory) {
    globalMemory = {
      chatHistory: [],
    };
  }
  return globalMemory;
}

/**
 * Reset global memory (useful for new content generation sessions)
 */
export function resetGlobalMemory() {
  globalMemory = null;
}

/**
 * Agent output structure for argumentation
 * Agents output ONLY plain text prompts - no JSON
 */
export interface AgentArgumentationOutput {
  modified_prompt: string; // Single prompt string - plain text only
}

/**
 * Final agent output structure
 * Final agent outputs ONLY plain text image prompt
 */
export interface FinalAgentOutput {
  imagePrompt: string; // Plain text prompt only
}

/**
 * Execute a ReAct agent with shared memory
 * Agents collaborate through argumentation and prompt modification
 */
export async function executeReActAgent(
  agent: AgentDefinition,
  contentType: ContentTypeDefinition,
  previousPrompt: string | null,
  dynamicInputs: Record<string, any>,
  sceneContext: {
    sceneIndex?: number;
    scenePurpose?: string;
    isFinalAgent: boolean;
  }
): Promise<AgentArgumentationOutput | FinalAgentOutput> {
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: agent.temperature ?? 0.7,
    openAIApiKey: getApiKey(),
  });

  // Build dynamic system prompt from contentType + agent role
  const systemPromptBase = contentType.prompting?.systemPromptTemplate || '';
  const agentRoleContext = `You are ${agent.name}, a ${agent.role}. ${agent.systemPrompt || agent.prompt || ''}`;
  const dynamicSystemPrompt = `${systemPromptBase}\n\n${agentRoleContext}`;
  
  // Get chat history from global memory
  const memory = getGlobalMemory();

  // Build dynamic user prompt based on context
  let userPrompt = '';
  
  if (sceneContext.isFinalAgent) {
    // Final agent: incorporate actual input values and produce scene output
    const inputValuesText = Object.entries(dynamicInputs)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: ${value.join(', ')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    userPrompt = `You are the final agent responsible for creating the scene output.

IMPORTANT: The system prompt above contains CRITICAL CONSTRAINTS that MUST be followed. If the scene purpose below conflicts with system prompt requirements, you MUST prioritize the system prompt constraints. The system prompt requirements take precedence over scene purpose descriptions.

Previous collaborative work from other agents:
${previousPrompt || 'No previous work'}

Actual input values to incorporate:
${inputValuesText}

Scene context:
- Scene Index: ${sceneContext.sceneIndex || 'N/A'}
- Scene Purpose: ${sceneContext.scenePurpose || 'N/A'}

NOTE: If the Scene Purpose conflicts with system prompt requirements (e.g., system prompt requires "pure white background" but scene purpose mentions "outdoor setting"), you MUST modify the prompt to follow the system prompt constraints while incorporating the scene's core intent and the actual input values.

Your task:
1. Review the system prompt constraints FIRST - these are mandatory requirements
2. Review the previous collaborative prompt
3. Ensure the final prompt strictly follows all system prompt requirements for this scene index
4. Replace all generic/placeholder words with the actual input values provided above
5. Output ONLY a single, complete, detailed image prompt as plain text that respects system prompt constraints
6. The prompt should be ready for image generation - detailed, specific, and incorporating all actual values while adhering to system prompt requirements

Output ONLY the image prompt text. No JSON, no formatting, no titles, no explanations. Just the prompt.`;
  } else {
    // Regular agent: argue, critique, and modify prompt
    userPrompt = `You are ${agent.name} (${agent.role}). You are collaborating with other agents to refine a prompt.

IMPORTANT: The system prompt above contains CRITICAL CONSTRAINTS that MUST be followed. If the scene purpose below conflicts with system prompt requirements, you MUST prioritize the system prompt constraints. The system prompt requirements take precedence over scene purpose descriptions.

Previous agent's prompt:
${previousPrompt || 'This is the initial prompt - create the first version.'}

Dynamic inputs available:
${Object.entries(dynamicInputs)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: ${value.join(', ')}`;
    }
    return `${key}: ${value}`;
  })
  .join('\n')}

Scene context:
- Scene Index: ${sceneContext.sceneIndex || 'N/A'}
- Scene Purpose: ${sceneContext.scenePurpose || 'N/A'}

NOTE: If the Scene Purpose conflicts with system prompt requirements (e.g., system prompt requires "pure white background" but scene purpose mentions "outdoor setting"), you MUST ensure your modified prompt follows the system prompt constraints while incorporating the scene's core intent.

Your task:
1. Review the system prompt constraints FIRST - these are mandatory requirements
2. Review the previous prompt carefully
3. Ensure any modifications respect system prompt requirements for this scene index
4. Critique what should be changed based on your expertise (${agent.role})
5. Create a modified prompt that incorporates your changes while respecting system prompt constraints

Output ONLY the modified prompt as plain text. No JSON, no formatting, no titles, no explanations. Just the prompt text.`;
  }

  // Create prompt template with memory
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', dynamicSystemPrompt],
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

  // Save to memory
  memory.chatHistory.push(new HumanMessage(userPrompt));
  memory.chatHistory.push(new AIMessage(content));

  // Return plain text prompt - no JSON parsing
  if (sceneContext.isFinalAgent) {
    // Final agent returns the prompt as imagePrompt
    return {
      imagePrompt: content,
      negativePrompt: '',
      camera: {},
      environment: {},
      onScreenText: {},
      compositionNotes: '',
    } as FinalAgentOutput;
  } else {
    // Regular agent returns the modified prompt
    return {
      critique: '',
      changes: '',
      reasoning: '',
      modified_prompt: content,
    } as AgentArgumentationOutput;
  }
}

