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
 * Agents output structured JSON with changes, critique, reasoning, and modified prompt
 */
export interface AgentArgumentationOutput {
  changes: string; // Description of what changes were made
  critique: string; // Critique of the previous prompt
  reasoning: string; // Reasoning behind the changes
  modified_prompt: string; // The improved prompt with substantial modifications
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

CRITICAL: You MUST PRESERVE ALL suggestions and enhancements from previous agents. Do NOT remove or discard any contributions from the collaborative work above. Your role is to:
- Keep all previous suggestions intact
- Replace generic/placeholder words with actual input values
- Ensure system prompt constraints are met
- Polish and finalize the prompt for image generation
- Do NOT remove elements that previous agents suggested (e.g., if they mentioned "use a model", keep it; if they specified lighting techniques, keep them)

Your task:
1. Review the system prompt constraints FIRST - these are mandatory requirements
2. Review the previous collaborative prompt carefully - it contains valuable contributions from multiple agents
3. PRESERVE all suggestions and enhancements from previous agents - do not remove them
4. Replace all generic/placeholder words with the actual input values provided above
5. Ensure the final prompt strictly follows all system prompt requirements for this scene index
6. Output ONLY a single, complete, detailed image prompt as plain text that:
   - Includes ALL previous agents' suggestions
   - Incorporates all actual input values
   - Respects system prompt constraints
   - Is ready for image generation (detailed, specific, comprehensive)

The prompt should be the culmination of all previous work, with actual values substituted and system constraints applied.

Output ONLY the image prompt text. No JSON, no formatting, no titles, no explanations. Just the prompt.`;
  } else {
    // Regular agent: argue, critique, and modify prompt
    userPrompt = `You are ${agent.name} (${agent.role}). You are collaborating with other agents to refine a prompt as part of a team.

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
2. Review the previous prompt carefully and provide a DETAILED critique based on your expertise (${agent.role})
3. Identify what needs to be added or improved - be specific and thorough
4. Explain your reasoning for the additions you're making
5. Create a MODIFIED prompt that ADDS your expertise while PRESERVING all previous suggestions

CRITICAL COLLABORATION REQUIREMENTS:
- You MUST PRESERVE and BUILD UPON all suggestions from previous agents - do NOT remove or discard their contributions
- ADD your expertise and enhancements to the existing prompt, don't rewrite it from scratch
- Support the previous work as a good team member - enhance and complement, don't contradict or remove
- Keep the core purpose and direction established by previous agents - don't change the fundamental approach
- If a previous agent suggested something (e.g., "use a model", "specific lighting technique", "particular angle"), you MUST include it in your modified prompt
- Your role is to ADD value, not to redirect or replace previous work
- Add specific details, technical specifications, artistic direction, or other meaningful enhancements based on your role
- Think about what a ${agent.role} would contribute that others might miss, and ADD those contributions to the existing prompt
- If you're the first agent and there's no previous prompt, create a comprehensive, detailed initial prompt
- Your modified prompt should be the previous prompt PLUS your enhancements - it should be longer and more detailed, not shorter

Remember: This is a collaborative team effort. Each agent builds on the previous work, making it better by adding their expertise, not by removing what others have contributed.

Output your response as a JSON object with the following structure (note: the curly braces shown are literal JSON syntax, not placeholders):
{{
  "changes": "A detailed description of what specific additions or enhancements you made to the prompt. Be thorough and explain each addition while noting what you preserved from previous agents.",
  "critique": "A comprehensive critique of the previous prompt. Identify strengths, weaknesses, missing elements, and areas for improvement based on your expertise as a ${agent.role}.",
  "reasoning": "Your reasoning for making these additions. Explain why these enhancements improve the prompt and how they align with your role as a ${agent.role}, while supporting previous agents' work.",
  "modified_prompt": "The enhanced prompt that PRESERVES all previous suggestions and ADDS your expertise. This should include everything from the previous prompt PLUS your additions - it should be longer and more comprehensive."
}}

IMPORTANT: Output ONLY valid JSON. Do not include any markdown code blocks, explanations, or additional text outside the JSON object.`;
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

  // Return based on agent type
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
    // Regular agent: parse JSON response
    try {
      const parsed = JSON.parse(content);
      
      // Validate and extract fields
      const argumentation: AgentArgumentationOutput = {
        changes: parsed.changes || '',
        critique: parsed.critique || '',
        reasoning: parsed.reasoning || '',
        modified_prompt: parsed.modified_prompt || content, // Fallback to full content if parsing fails
      };

      // Validate that we got meaningful content
      if (!argumentation.modified_prompt || argumentation.modified_prompt.trim().length === 0) {
        throw new Error('Modified prompt is empty');
      }

      return argumentation;
    } catch (error) {
      // If JSON parsing fails, try to extract JSON from the response
      // Sometimes LLMs wrap JSON in text or markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            changes: parsed.changes || '',
            critique: parsed.critique || '',
            reasoning: parsed.reasoning || '',
            modified_prompt: parsed.modified_prompt || content,
          } as AgentArgumentationOutput;
        } catch (e) {
          // If still fails, return with content as modified_prompt and empty other fields
          console.warn(`Failed to parse agent JSON response: ${error}. Using fallback.`);
          return {
            changes: 'Failed to parse agent response',
            critique: 'Failed to parse agent response',
            reasoning: 'Failed to parse agent response',
            modified_prompt: content,
          } as AgentArgumentationOutput;
        }
      }
      
      // Last resort: return content as modified_prompt
      console.warn(`Failed to parse agent JSON response: ${error}. Using content as modified_prompt.`);
      return {
        changes: 'Failed to parse agent response',
        critique: 'Failed to parse agent response',
        reasoning: 'Failed to parse agent response',
        modified_prompt: content,
      } as AgentArgumentationOutput;
    }
  }
}

