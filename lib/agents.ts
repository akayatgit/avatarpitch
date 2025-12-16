import { ChatOpenAI } from '@langchain/openai';
import { supabaseAdmin } from './supabaseAdmin';

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

// Fetch agent from database by role
export async function getAgentByRole(role: string): Promise<AgentDefinition | null> {
  const { data } = await supabaseAdmin
    .from('agents')
    .select('id, name, role, system_prompt, prompt, temperature')
    .eq('role', role)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    role: data.role,
    name: data.name,
    systemPrompt: data.system_prompt || undefined,
    prompt: data.prompt || undefined,
    temperature: data.temperature || 0.7,
    order: 0, // Will be set by workflow
  };
}

// Fetch all agents from database
export async function getAllAgents(): Promise<AgentDefinition[]> {
  const { data } = await supabaseAdmin
    .from('agents')
    .select('id, name, role, system_prompt, prompt, temperature')
    .order('created_at', { ascending: true });

  if (!data) return [];

  return data.map((agent) => ({
    id: agent.id,
    role: agent.role,
    name: agent.name,
    systemPrompt: agent.system_prompt || undefined,
    prompt: agent.prompt || undefined,
    temperature: agent.temperature || 0.7,
    order: 0, // Will be set by workflow
  }));
}

// Agent role definitions
export const AGENT_ROLES = {
  FASHION_EXPERT: 'fashion_expert',
  FABRICS_EXPERT: 'fabrics_expert',
  SALES_PERSON: 'sales_person',
  TREND_IDENTIFIER: 'trend_identifier',
  VIDEO_DIRECTOR: 'video_director',
  COPYWRITER: 'copywriter',
  BRAND_STRATEGIST: 'brand_strategist',
  VISUAL_STYLIST: 'visual_stylist',
} as const;

export type AgentRole = typeof AGENT_ROLES[keyof typeof AGENT_ROLES];

export interface AgentDefinition {
  id: string;
  role: AgentRole | string; // Allow custom roles like 'shot_planner', 'creative_strategist', etc.
  name: string;
  systemPrompt?: string;
  prompt?: string; // Task-specific prompt (for new workflow format)
  temperature?: number;
  order: number;
  inputFrom?: string[]; // IDs of agents whose output this agent uses
  outputTo?: string[]; // IDs of agents that use this agent's output
  readsFrom?: string[]; // Shared state keys to read (new format)
  writesTo?: string[]; // Shared state keys to write (new format)
}

export interface AgentWorkflow {
  agents: AgentDefinition[];
  executionOrder: 'sequential' | 'parallel' | 'custom';
}

// Agent role system prompts
const AGENT_SYSTEM_PROMPTS: Record<AgentRole, string> = {
  [AGENT_ROLES.FASHION_EXPERT]:
    'You are a fashion expert with deep knowledge of trends, styles, and aesthetics. You understand what makes clothing appealing and how to present fashion items in the best light.',
  [AGENT_ROLES.FABRICS_EXPERT]:
    'You are a fabrics and materials expert. You understand textile properties, quality indicators, comfort factors, and how to highlight material benefits.',
  [AGENT_ROLES.SALES_PERSON]:
    'You are a persuasive sales professional. You know how to create compelling offers, highlight value propositions, and create urgency that drives action.',
  [AGENT_ROLES.TREND_IDENTIFIER]:
    'You are a trend identifier who understands current market trends, seasonal patterns, and what resonates with target audiences.',
  [AGENT_ROLES.VIDEO_DIRECTOR]:
    'You are a video director specializing in short-form content. You understand camera angles, movements, visual composition, and how to create engaging video sequences.',
  [AGENT_ROLES.COPYWRITER]:
    'You are a copywriter who crafts compelling on-screen text, captions, and messaging that captures attention and drives engagement.',
  [AGENT_ROLES.BRAND_STRATEGIST]:
    'You are a brand strategist who understands brand positioning, target audience psychology, and how to align product messaging with brand values.',
  [AGENT_ROLES.VISUAL_STYLIST]:
    'You are a visual stylist who creates beautiful, cohesive visual presentations. You understand color, composition, lighting, and aesthetic appeal.',
};

export function getAgentSystemPrompt(role: AgentRole | string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;
  if (typeof role === 'string' && role in AGENT_SYSTEM_PROMPTS) {
    return AGENT_SYSTEM_PROMPTS[role as AgentRole];
  }
  // If no custom prompt and role not in static list, return a generic prompt
  return `You are an AI agent specialized in ${role}. Provide expert analysis and recommendations.`;
}

export function createAgentLLM(agent: AgentDefinition): ChatOpenAI {
  return new ChatOpenAI({
    modelName: getModel(),
    temperature: agent.temperature ?? 0.7,
    openAIApiKey: getApiKey(),
  });
}

export async function executeAgent(
  agent: AgentDefinition,
  input: {
    productInfo: any;
    previousAgentOutputs: Record<string, any>;
    sceneIndex?: number;
    sceneType?: string;
  }
): Promise<any> {
  const llm = createAgentLLM(agent);

  // Build context from previous agents if specified
  let context = '';
  if (agent.inputFrom && agent.inputFrom.length > 0) {
    context = '\n\nCONTEXT FROM PREVIOUS AGENTS:\n';
    agent.inputFrom.forEach((agentId) => {
      if (input.previousAgentOutputs[agentId]) {
        context += `- ${agentId}: ${JSON.stringify(input.previousAgentOutputs[agentId], null, 2)}\n`;
      }
    });
  }

  const systemPrompt = getAgentSystemPrompt(agent.role, agent.systemPrompt);
  
  const prompt = `${systemPrompt}${context}

TASK:
${input.sceneIndex ? `Generate content for Scene ${input.sceneIndex} (${input.sceneType})` : 'Generate content for the video project'}

PRODUCT INFORMATION:
${JSON.stringify(input.productInfo, null, 2)}

Provide your expert analysis and recommendations in a structured format.`;

  const response = await llm.invoke(prompt);
  const content = typeof response.content === 'string' ? response.content : String(response.content);

  // Try to parse as JSON if possible
  try {
    return JSON.parse(content);
  } catch {
    return { output: content, agentId: agent.id, role: agent.role };
  }
}

export async function executeWorkflow(
  workflow: AgentWorkflow,
  input: {
    productInfo: any;
    sceneIndex?: number;
    sceneType?: string;
  }
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const sortedAgents = [...workflow.agents].sort((a, b) => a.order - b.order);

  if (workflow.executionOrder === 'parallel') {
    // Execute all agents in parallel
    const promises = sortedAgents.map((agent) =>
      executeAgent(agent, {
        ...input,
        previousAgentOutputs: results,
      })
    );
    const outputs = await Promise.all(promises);
    sortedAgents.forEach((agent, index) => {
      results[agent.id] = outputs[index];
    });
  } else {
    // Sequential execution
    for (const agent of sortedAgents) {
      const output = await executeAgent(agent, {
        ...input,
        previousAgentOutputs: results,
      });
      results[agent.id] = output;
    }
  }

  return results;
}

