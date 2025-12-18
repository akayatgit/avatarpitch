import { ChatOpenAI } from '@langchain/openai';
import { AgentDefinition } from '../agents';
import {
  getAgentSystemPrompt,
  getAgentTaskDescription,
  getSceneSpecificGuidance,
  getFinalAgentPrompt,
  getRegularAgentPrompt,
} from './promptLibrary';

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

export interface AgentExecutionInput {
  agent: AgentDefinition;
  visibleState: Record<string, any>;
  limits: any;
  cameraPresets: string[];
  shotLibrary?: any[];
  scenePurpose?: string;
  isFinalAgent?: boolean;
}

/**
 * Executes a single agent with shared state
 * Each agent receives previous agent outputs and produces its own output
 */
export async function executeAgentWithSharedState(
  input: AgentExecutionInput
): Promise<Record<string, any>> {
  const { agent, visibleState, limits, cameraPresets, shotLibrary, scenePurpose, isFinalAgent } = input;
  
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: agent.temperature ?? 0.7,
    openAIApiKey: getApiKey(),
  });

  // Build prompt
  const systemPrompt = agent.systemPrompt || agent.prompt || getAgentSystemPrompt(agent.name, agent.role);
  
  const readsFromKeys = agent.readsFrom || agent.inputFrom || ['input'];
  const writesToKeys = agent.writesTo || [agent.id];
  
  // Build a more helpful prompt that guides the agent
  const hasInput = visibleState.input !== undefined;
  const hasOtherAgents = Object.keys(visibleState).some(k => k !== 'input' && k.startsWith('agent_'));
  
  const taskDescription = agent.prompt || getAgentTaskDescription(agent.role, hasInput, hasOtherAgents);
  
  // Build scene-specific guidance - focus on the current scene purpose
  const sceneInfo = scenePurpose 
    ? shotLibrary?.find((s: any) => (s.type || s.purpose) === scenePurpose)
    : null;
  
  const sceneSpecificGuidance = scenePurpose 
    ? getSceneSpecificGuidance(
        scenePurpose,
        visibleState.sceneIndex || '?',
        sceneInfo?.goal || sceneInfo?.purpose
      )
    : '';

  let userPrompt: string;
  
  if (isFinalAgent) {
    // Final agent must create the imagePrompt
    userPrompt = getFinalAgentPrompt(
      agent.name,
      agent.role,
      visibleState.sceneIndex || '?',
      scenePurpose || '',
      visibleState,
      limits,
      cameraPresets
    );
  } else {
    // Regular agents provide insights
    userPrompt = getRegularAgentPrompt(
      agent.name,
      agent.role,
      taskDescription,
      sceneSpecificGuidance,
      scenePurpose,
      visibleState.sceneIndex,
      visibleState,
      writesToKeys
    );
  }

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await llm.invoke(fullPrompt);
  
  if (!response) {
    throw new Error('No response received from LLM');
  }
  
  let content: string;
  if (typeof response.content === 'string') {
    content = response.content;
  } else if (response.content) {
    content = String(response.content);
  } else {
    throw new Error('Empty response content from LLM');
  }

  // Clean JSON from markdown code fences
  content = content.trim();
  if (!content) {
    throw new Error('Empty content after trimming');
  }
  
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }
  content = content.trim();
  
  if (!content) {
    throw new Error('Empty content after removing markdown');
  }

  try {
    if (!JSON || typeof JSON.parse !== 'function') {
      throw new Error('JSON.parse is not available');
    }
    const parsed = JSON.parse(content);
    
    // For final agent, return the parsed object directly since it contains imagePrompt at top level
    if (isFinalAgent) {
      if (!parsed.imagePrompt) {
        throw new Error(`Final agent (${agent.name} - ${agent.role}) response missing required 'imagePrompt' field`);
      }
      return parsed;
    }
    
    // For non-final agents, use writesToKeys mapping
    const firstKey = writesToKeys[0];
    if (parsed[firstKey] && typeof parsed[firstKey] === 'string') {
      const value = parsed[firstKey].toLowerCase();
      if (value.includes('no data') || value.includes('empty') || value.includes('no context')) {
        // Log warning but continue
      }
    }
    
    // Map parsed keys to writesToKeys
    const result: Record<string, any> = {};
    writesToKeys.forEach(key => {
      if (parsed[key] !== undefined) {
        result[key] = parsed[key];
      } else if (parsed[firstKey] !== undefined) {
        result[key] = parsed[firstKey];
      } else {
        result[key] = parsed;
      }
    });
    
    return result;
  } catch (e) {
    // If parsing fails, try to extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // For final agent, return parsed object directly
        if (isFinalAgent) {
          if (!parsed.imagePrompt) {
            throw new Error(`Final agent (${agent.name} - ${agent.role}) response missing required 'imagePrompt' field`);
          }
          return parsed;
        }
        
        const result: Record<string, any> = {};
        writesToKeys.forEach(key => {
          result[key] = parsed[key] !== undefined ? parsed[key] : parsed[writesToKeys[0]] || content;
        });
        return result;
      } catch {
        // Fallback: return as structured object with the content
        const result: Record<string, any> = {};
        writesToKeys.forEach(key => {
          result[key] = content;
        });
        return result;
      }
    }
    // Last resort fallback
    const result: Record<string, any> = {};
    writesToKeys.forEach(key => {
      result[key] = content;
    });
    return result;
  }
}
