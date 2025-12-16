'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AGENT_ROLES, type AgentDefinition, type AgentWorkflow } from '@/lib/agents';

interface WorkflowEditorProps {
  templateId: string;
  initialConfig: any;
}

const AGENT_ROLE_NAMES: Record<string, string> = {
  fashion_expert: 'Fashion Expert',
  fabrics_expert: 'Fabrics Expert',
  sales_person: 'Sales Person',
  trend_identifier: 'Trend Identifier',
  video_director: 'Video Director',
  copywriter: 'Copywriter',
  brand_strategist: 'Brand Strategist',
  visual_stylist: 'Visual Stylist',
};

const AGENT_ROLE_DESCRIPTIONS: Record<string, string> = {
  fashion_expert: 'Expert in trends, styles, and aesthetics',
  fabrics_expert: 'Expert in textile properties and material benefits',
  sales_person: 'Creates compelling offers and drives action',
  trend_identifier: 'Identifies current market trends and patterns',
  video_director: 'Specializes in camera angles and visual composition',
  copywriter: 'Crafts compelling on-screen text and messaging',
  brand_strategist: 'Aligns messaging with brand values',
  visual_stylist: 'Creates beautiful visual presentations',
};

export default function WorkflowEditor({ templateId, initialConfig }: WorkflowEditorProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<AgentWorkflow>(() => {
    const workflowData = initialConfig.workflow?.agentWorkflow || {
      agents: [],
      executionOrder: 'sequential' as const,
    };
    return workflowData;
  });
  const [saving, setSaving] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgentRole, setNewAgentRole] = useState<string>('');

  const addAgent = () => {
    if (!newAgentRole) return;

    const newAgent: AgentDefinition = {
      id: `agent_${Date.now()}`,
      role: newAgentRole as any,
      name: AGENT_ROLE_NAMES[newAgentRole] || newAgentRole,
      order: workflow.agents.length + 1,
      temperature: 0.7,
    };

    setWorkflow({
      ...workflow,
      agents: [...workflow.agents, newAgent],
    });
    setNewAgentRole('');
    setShowAddAgent(false);
  };

  const removeAgent = (agentId: string) => {
    setWorkflow({
      ...workflow,
      agents: workflow.agents
        .filter((a: any) => a.id !== agentId)
        .map((a: any, index: number) => ({ ...a, order: index + 1 })),
    });
  };

  const updateAgent = (agentId: string, updates: Partial<AgentDefinition>) => {
    setWorkflow({
      ...workflow,
      agents: workflow.agents.map((a: any) => (a.id === agentId ? { ...a, ...updates } : a)),
    });
  };

  const connectAgents = (fromId: string, toId: string) => {
    setWorkflow({
      ...workflow,
      agents: workflow.agents.map((agent: any) => {
        if (agent.id === toId) {
          return {
            ...agent,
            inputFrom: [...(agent.inputFrom || []), fromId],
          };
        }
        if (agent.id === fromId) {
          return {
            ...agent,
            outputTo: [...(agent.outputTo || []), toId],
          };
        }
        return agent;
      }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });

      if (!response.ok) {
        throw new Error('Failed to save workflow');
      }

      router.refresh();
      alert('Workflow saved successfully!');
    } catch (error) {
      alert('Failed to save workflow: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const sortedAgents = [...workflow.agents].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Execution Order */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
          Execution Order
        </h2>
        <select
          value={workflow.executionOrder}
          onChange={(e) =>
            setWorkflow({ ...workflow, executionOrder: e.target.value as any })
          }
          className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3 min-h-[44px] touch-manipulation"
        >
          <option value="sequential">Sequential (one after another)</option>
          <option value="parallel">Parallel (all at once)</option>
          <option value="custom">Custom (based on connections)</option>
        </select>
      </div>

      {/* Agents List */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Agents</h2>
          <button
            onClick={() => setShowAddAgent(!showAddAgent)}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 transition-all text-sm font-medium touch-manipulation min-h-[44px]"
          >
            + Add Agent
          </button>
        </div>

        {showAddAgent && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Agent Role
            </label>
            <select
              value={newAgentRole}
              onChange={(e) => setNewAgentRole(e.target.value)}
              className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3 mb-3 min-h-[44px] touch-manipulation"
            >
              <option value="">Choose a role...</option>
              {Object.entries(AGENT_ROLES).map(([key, value]) => (
                <option key={value} value={value}>
                  {AGENT_ROLE_NAMES[value]} - {AGENT_ROLE_DESCRIPTIONS[value]}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={addAgent}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 transition-all text-sm font-medium touch-manipulation"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddAgent(false);
                  setNewAgentRole('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl active:bg-gray-300 active:scale-95 transition-all text-sm font-medium touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {sortedAgents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              allAgents={sortedAgents}
              onUpdate={(updates) => updateAgent(agent.id, updates)}
              onRemove={() => removeAgent(agent.id)}
              onConnect={(toId) => connectAgents(agent.id, toId)}
            />
          ))}
          {sortedAgents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No agents configured. Add agents to create a workflow.
            </p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3.5 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all font-medium shadow-md touch-manipulation min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  index,
  allAgents,
  onUpdate,
  onRemove,
  onConnect,
}: {
  agent: AgentDefinition;
  index: number;
  allAgents: AgentDefinition[];
  onUpdate: (updates: Partial<AgentDefinition>) => void;
  onRemove: () => void;
  onConnect: (toId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const availableConnections = allAgents.filter((a: AgentDefinition) => a.id !== agent.id && a.order > agent.order);

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">#{agent.order}</span>
            <h3 className="text-base font-semibold text-gray-900">{agent.name}</h3>
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">
              {agent.role}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {AGENT_ROLE_DESCRIPTIONS[agent.role] || 'No description'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <button
            onClick={onRemove}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Custom System Prompt (optional)
            </label>
            <textarea
              value={agent.systemPrompt || ''}
              onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
              rows={3}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-sm px-3 py-2"
              placeholder="Leave empty to use default prompt for this role"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Temperature (0-2)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={agent.temperature ?? 0.7}
              onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>

          {agent.inputFrom && agent.inputFrom.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Receives input from:
              </label>
              <div className="flex flex-wrap gap-2">
                {agent.inputFrom.map((fromId: string) => {
                  const fromAgent = allAgents.find((a: AgentDefinition) => a.id === fromId);
                  return (
                    <span
                      key={fromId}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg"
                    >
                      {fromAgent?.name || fromId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {availableConnections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Connect output to:
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onConnect(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-sm px-3 py-2"
              >
                <option value="">Select agent...</option>
                {availableConnections.map((a: AgentDefinition) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

