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

/** Preferred default pipeline when a content type has no workflow configured. */
const DEFAULT_WORKFLOW_ROLES = [
  'creative_strategist',
  'copywriter',
  'visual_stylist',
  'production_design',
  'video_director',
  'shot_planner',
  'final_assembler',
] as const;

/** Parse agentWorkflow / agents from a content type prompting blob. */
export function parseAgentWorkflowFromContentType(contentType: {
  prompting?: any;
}): AgentWorkflow | null {
  let agentWorkflow: any = contentType.prompting?.agentWorkflow;

  if (!agentWorkflow && contentType.prompting?.agents) {
    const agents = contentType.prompting.agents;
    if (Array.isArray(agents) && agents.length > 0) {
      const firstAgent = agents[0];
      if (typeof firstAgent === 'object' && firstAgent?.id) {
        agentWorkflow = {
          agents,
          executionOrder: 'sequential' as const,
        };
      } else if (typeof firstAgent === 'string') {
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

  if (agentWorkflow?.agents?.length > 0) {
    return agentWorkflow as AgentWorkflow;
  }
  return null;
}

/** Load a sensible default workflow from the agents table. */
export async function loadDefaultAgentWorkflow(): Promise<AgentWorkflow> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, role, system_prompt, prompt, temperature');

  if (error) {
    throw new Error(`Failed to load agents: ${error.message}`);
  }

  const byRole = new Map((data || []).map((a: any) => [a.role, a]));
  const selected: AgentDefinition[] = [];

  DEFAULT_WORKFLOW_ROLES.forEach((role, idx) => {
    const agent = byRole.get(role);
    if (!agent) return;
    selected.push({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      systemPrompt: agent.system_prompt || undefined,
      prompt: agent.prompt || undefined,
      temperature: agent.temperature != null ? Number(agent.temperature) : 0.7,
      order: idx + 1,
    });
  });

  // If preferred roles missing, fall back to first N agents from DB
  if (selected.length === 0 && data && data.length > 0) {
    data.slice(0, 6).forEach((agent: any, idx: number) => {
      selected.push({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        systemPrompt: agent.system_prompt || undefined,
        prompt: agent.prompt || undefined,
        temperature: agent.temperature != null ? Number(agent.temperature) : 0.7,
        order: idx + 1,
      });
    });
  }

  return { agents: selected, executionOrder: 'sequential' };
}

/**
 * Resolve workflow from content type, or auto-attach default agents from DB
 * so generation doesn't hang when the workflow editor was never configured.
 */
export async function resolveAgentWorkflow(contentType: {
  name?: string;
  prompting?: any;
}): Promise<AgentWorkflow> {
  const fromContentType = parseAgentWorkflowFromContentType(contentType);
  if (fromContentType) return fromContentType;

  const fallback = await loadDefaultAgentWorkflow();
  if (!fallback.agents.length) {
    throw new Error(
      `No agents configured for content type "${contentType.name || 'unknown'}". ` +
        `Please configure agents in the workflow editor (or seed the agents table).`
    );
  }
  return fallback;
}


