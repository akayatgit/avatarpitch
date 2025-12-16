'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AGENT_ROLES, type AgentDefinition, type AgentWorkflow } from '@/lib/agents';

interface ReactFlowWorkflowEditorProps {
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

const AGENT_ROLE_ICONS: Record<string, string> = {
  fashion_expert: '👗',
  fabrics_expert: '🧵',
  sales_person: '💰',
  trend_identifier: '📈',
  video_director: '🎥',
  copywriter: '✍️',
  brand_strategist: '🎯',
  visual_stylist: '🎨',
};

const AGENT_COLORS: Record<string, string> = {
  fashion_expert: 'bg-purple-500',
  fabrics_expert: 'bg-blue-500',
  sales_person: 'bg-green-500',
  trend_identifier: 'bg-yellow-500',
  video_director: 'bg-red-500',
  copywriter: 'bg-indigo-500',
  brand_strategist: 'bg-pink-500',
  visual_stylist: 'bg-orange-500',
};

// Custom Start Node Component
function StartNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-3 bg-purple-600 text-white rounded-lg shadow-lg min-w-[160px]">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <span className="font-medium">Start Flow</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !border-2 !border-gray-400 !w-3 !h-3" />
    </div>
  );
}

// Custom Agent Node Component
function AgentNode({ data, selected }: { data: any; selected: boolean }) {
  const colorClass = AGENT_COLORS[data.role] || 'bg-gray-500';
  const icon = AGENT_ROLE_ICONS[data.role] || '⚙️';

  return (
    <div className={`px-4 py-3 ${colorClass} text-white rounded-lg shadow-lg min-w-[180px] ${selected ? 'ring-2 ring-yellow-400' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-white !border-2 !border-gray-400 !w-3 !h-3" />
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-medium text-sm">{data.name}</span>
        </div>
        <div className="flex gap-1">
          <button
            className="w-5 h-5 rounded hover:bg-black/20 flex items-center justify-center text-xs"
            onClick={() => data.onSettings?.(data.id)}
            title="Settings"
          >
            ⚙️
          </button>
          <button
            className="w-5 h-5 rounded hover:bg-black/20 flex items-center justify-center text-xs"
            onClick={() => data.onDelete?.(data.id)}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="text-xs opacity-90 truncate">{data.role}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !border-2 !border-gray-400 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  agent: AgentNode,
};

interface DatabaseAgent {
  id: string;
  name: string;
  role: string;
  system_prompt: string | null;
  prompt: string | null;
  temperature: number;
}

export default function ReactFlowWorkflowEditor({ templateId, initialConfig }: ReactFlowWorkflowEditorProps) {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [availableAgents, setAvailableAgents] = useState<DatabaseAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  
  // Fetch agents from database on mount
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/agents');
        if (response.ok) {
          const data = await response.json();
          setAvailableAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    }
    fetchAgents();
  }, []);
  
  // Parse config if it's a string (sometimes Supabase returns JSONB as string)
  const parsedConfig = (() => {
    if (typeof initialConfig === 'string') {
      try {
        return JSON.parse(initialConfig);
      } catch (e) {
        console.error('Failed to parse config string:', e);
        return null;
      }
    }
    return initialConfig;
  })();
  
  // Initialize workflow from config - extract once at component level
  const initialWorkflowData = parsedConfig?.workflow?.agentWorkflow;
  const initialWorkflow: AgentWorkflow = (() => {
    if (initialWorkflowData && initialWorkflowData.agents && Array.isArray(initialWorkflowData.agents) && initialWorkflowData.agents.length > 0) {
      return {
        agents: initialWorkflowData.agents,
        executionOrder: initialWorkflowData.executionOrder || 'sequential',
      };
    }
    
    return {
      agents: [],
      executionOrder: 'sequential' as const,
    };
  })();
  
  const [workflow, setWorkflow] = useState<AgentWorkflow>(initialWorkflow);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Sync workflow when initialConfig changes (e.g., after page refresh or save)
  // Only sync if we have no agents currently (initial load) or if the config actually changed
  useEffect(() => {
    // Skip if we already have agents (user is editing)
    if (workflow.agents.length > 0) {
      return;
    }
    
    const configToUse = typeof initialConfig === 'string' ? JSON.parse(initialConfig) : initialConfig;
    const workflowData = configToUse?.workflow?.agentWorkflow;
    if (workflowData && workflowData.agents && Array.isArray(workflowData.agents) && workflowData.agents.length > 0) {
      setWorkflow({
        agents: workflowData.agents,
        executionOrder: workflowData.executionOrder || 'sequential',
      });
    }
  }, [initialConfig]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'start') return; // Can't delete start node

    setWorkflow((prev) => ({
      ...prev,
      agents: prev.agents
        .filter((a) => a.id !== nodeId)
        .map((a) => ({
          ...a,
          inputFrom: a.inputFrom?.filter(id => id !== nodeId) || [],
          outputTo: a.outputTo?.filter(id => id !== nodeId) || [],
        }))
        .map((a, index) => ({ ...a, order: index + 1 })),
    }));
  }, []);

  const handleNodeSettings = useCallback((nodeId: string) => {
    // Open settings modal or panel
    // TODO: Implement node settings modal
  }, []);

  // Initialize nodes and edges directly from initialWorkflow (computed once, not as callbacks)
  const initialNodes: Node[] = (() => {
    const nodeList: Node[] = [
      {
        id: 'start',
        type: 'start',
        position: { x: 300, y: 40 },
        data: {},
      },
    ];

    initialWorkflow.agents.forEach((agent, index) => {
      nodeList.push({
        id: agent.id,
        type: 'agent',
        position: { x: 300, y: 150 + index * 180 },
        data: {
          ...agent,
          onDelete: handleDeleteNode,
          onSettings: handleNodeSettings,
        },
      });
    });

    return nodeList;
  })();

  const initialEdges: Edge[] = (() => {
    const edgeList: Edge[] = [];

    // Start Flow connections
    initialWorkflow.agents.forEach((agent) => {
      if (agent.inputFrom?.includes('start')) {
        edgeList.push({
          id: `start-${agent.id}`,
          source: 'start',
          target: agent.id,
          type: 'smoothstep',
          animated: true,
        });
      }
    });

    // Agent to agent connections
    initialWorkflow.agents.forEach((agent) => {
      agent.outputTo?.forEach((targetId) => {
        edgeList.push({
          id: `${agent.id}-${targetId}`,
          source: agent.id,
          target: targetId,
          type: 'smoothstep',
          animated: true,
        });
      });
    });

    return edgeList;
  })();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when workflow changes (only if workflow actually changed, not on initial mount)
  useEffect(() => {
    if (workflow.agents.length === 0) {
      return; // Don't sync if no agents
    }
    
    setNodes((nds) => {
      const startNode = nds.find(n => n.id === 'start') || { position: { x: 300, y: 40 } };
      const newNodes: Node[] = [
        {
          id: 'start',
          type: 'start',
          position: startNode.position,
          data: {},
        },
      ];

      workflow.agents.forEach((agent, index) => {
        const existingNode = nds.find(n => n.id === agent.id);
        newNodes.push({
          id: agent.id,
          type: 'agent',
          position: existingNode?.position || { x: 300, y: 150 + index * 180 },
          data: {
            ...agent,
            onDelete: handleDeleteNode,
            onSettings: handleNodeSettings,
          },
        });
      });

      return newNodes;
    });
  }, [workflow.agents.length, handleDeleteNode, handleNodeSettings, setNodes]);

  // Sync edges when workflow changes (only if workflow actually changed, not on initial mount)
  useEffect(() => {
    // Skip if this is the initial load (edges already initialized from initialWorkflow)
    if (workflow.agents.length === 0) {
      return;
    }
    
    // Only sync if workflow actually changed (not initial state)
    const currentEdgeIds = new Set(edges.map(e => e.id));
    const workflowEdgeIds = new Set<string>();
    workflow.agents.forEach((agent) => {
      if (agent.inputFrom?.includes('start')) {
        workflowEdgeIds.add(`start-${agent.id}`);
      }
      agent.outputTo?.forEach((targetId) => {
        workflowEdgeIds.add(`${agent.id}-${targetId}`);
      });
    });
    
    const edgesChanged = 
      currentEdgeIds.size !== workflowEdgeIds.size ||
      ![...workflowEdgeIds].every(id => currentEdgeIds.has(id));
    
    if (!edgesChanged && workflow.agents.length === initialWorkflow.agents.length) {
      return; // No change, skip sync
    }
    
    setEdges(() => {
      const newEdges: Edge[] = [];

      workflow.agents.forEach((agent) => {
        if (agent.inputFrom?.includes('start')) {
          newEdges.push({
            id: `start-${agent.id}`,
            source: 'start',
            target: agent.id,
            type: 'smoothstep',
            animated: true,
          });
        }
      });

      workflow.agents.forEach((agent) => {
        agent.outputTo?.forEach((targetId) => {
          newEdges.push({
            id: `${agent.id}-${targetId}`,
            source: agent.id,
            target: targetId,
            type: 'smoothstep',
            animated: true,
          });
        });
      });

      return newEdges;
    });
  }, [workflow.agents.length, setEdges, edges.length]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const sourceId = params.source;
      const targetId = params.target;

      // Update workflow connections
      setWorkflow({
        ...workflow,
        agents: workflow.agents.map((agent) => {
          if (agent.id === sourceId && sourceId !== 'start') {
            const existingOutputs = agent.outputTo || [];
            if (!existingOutputs.includes(targetId)) {
              return {
                ...agent,
                outputTo: [...existingOutputs, targetId],
              };
            }
          }
          if (agent.id === targetId) {
            const existingInputs = agent.inputFrom || [];
            if (!existingInputs.includes(sourceId)) {
              return {
                ...agent,
                inputFrom: [...existingInputs, sourceId],
              };
            }
          }
          return agent;
        }),
      });

      // Handle start node connections
      if (sourceId === 'start') {
        setWorkflow({
          ...workflow,
          agents: workflow.agents.map((agent) => {
            if (agent.id === targetId) {
              const existingInputs = agent.inputFrom || [];
              if (!existingInputs.includes('start')) {
                return {
                  ...agent,
                  inputFrom: [...existingInputs, 'start'],
                };
              }
            }
            return agent;
          }),
        });
      }

      setEdges((eds) => addEdge(params, eds));
    },
    [workflow, setEdges]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((edge) => {
        const sourceId = edge.source;
        const targetId = edge.target;

        if (sourceId === 'start') {
          setWorkflow({
            ...workflow,
            agents: workflow.agents.map((agent) => {
              if (agent.id === targetId) {
                return {
                  ...agent,
                  inputFrom: agent.inputFrom?.filter(id => id !== 'start') || [],
                };
              }
              return agent;
            }),
          });
        } else {
          setWorkflow({
            ...workflow,
            agents: workflow.agents.map((agent) => {
              if (agent.id === sourceId) {
                return {
                  ...agent,
                  outputTo: agent.outputTo?.filter(id => id !== targetId) || [],
                };
              }
              if (agent.id === targetId) {
                return {
                  ...agent,
                  inputFrom: agent.inputFrom?.filter(id => id !== sourceId) || [],
                };
              }
              return agent;
            }),
          });
        }
      });
    },
    [workflow]
  );

  const addAgent = (agentId: string) => {
    const dbAgent = availableAgents.find(a => a.id === agentId);
    if (!dbAgent) return;

    const newAgent: AgentDefinition = {
      id: `agent_${Date.now()}_${dbAgent.id}`, // Use timestamp + DB ID to ensure uniqueness
      role: dbAgent.role,
      name: dbAgent.name,
      systemPrompt: dbAgent.system_prompt || undefined,
      prompt: dbAgent.prompt || undefined,
      temperature: dbAgent.temperature || 0.7,
      order: workflow.agents.length + 1,
    };

    const newNode: Node = {
      id: newAgent.id,
      type: 'agent',
      position: {
        x: 300,
        y: 150 + workflow.agents.length * 180,
      },
      data: {
        ...newAgent,
        onDelete: handleDeleteNode,
        onSettings: handleNodeSettings,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setWorkflow({
      ...workflow,
      agents: [...workflow.agents, newAgent],
    });
    setShowAddAgent(false);
  };

  const handleSave = async () => {
    if (saving) return; // Prevent double-save
    
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save workflow');
      }
      
      // Verify the save was successful by checking the response
      if (!result.success) {
        throw new Error('Save operation did not return success');
      }
      
      // Show success message
      alert('Workflow saved successfully!');
      
      // Reload the page to get fresh data from the server
      // Use a longer delay to ensure the database write is committed
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-250px)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">⚡</span>
            </div>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="flex-1 bg-gray-700 text-white px-2 py-1.5 rounded text-sm min-w-0"
              placeholder="Workflow Name"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 flex-shrink-0">
              +
            </button>
            <span>Agents</span>
            <button className="ml-auto">☰</button>
          </div>
        </div>

        {/* Agents List */}
        <div className="flex-1 overflow-y-auto p-2">
          {workflow.agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-gray-700 rounded-lg p-3 mb-2 cursor-pointer hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">{AGENT_ROLE_ICONS[agent.role] || '⚙️'}</span>
                  <span className="text-sm truncate">{agent.name}</span>
                </div>
              </div>
            </div>
          ))}
          {workflow.agents.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No agents yet</p>
          )}
        </div>

        {/* Add Agent Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => setShowAddAgent(!showAddAgent)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium transition-colors text-sm"
          >
            + Add Agent
          </button>
          {showAddAgent && (
            <div className="mt-2 bg-gray-700 rounded-lg p-2 max-h-64 overflow-y-auto">
              {loadingAgents ? (
                <p className="text-gray-400 text-sm text-center py-4">Loading agents...</p>
              ) : availableAgents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  No agents available. <a href="/app/agents" className="text-orange-400 underline">Create one</a>
                </p>
              ) : (
                availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => addAgent(agent.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-600 rounded text-sm mb-1 flex items-center gap-2"
                  >
                    <span>{AGENT_ROLE_ICONS[agent.role] || '⚙️'}</span>
                    <span>{agent.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">({agent.role})</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-100"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
        </ReactFlow>

        {/* Save Button */}
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}

