'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AGENT_ROLES, type AgentDefinition, type AgentWorkflow } from '@/lib/agents';

interface VisualWorkflowEditorProps {
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

interface WorkflowNode {
  id: string;
  agent: AgentDefinition;
  x: number;
  y: number;
  connections: string[];
}

interface ConnectionPoint {
  nodeId: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  x: number;
  y: number;
}

export default function VisualWorkflowEditor({ templateId, initialConfig }: VisualWorkflowEditorProps) {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [workflow, setWorkflow] = useState<AgentWorkflow>(() => {
    const workflowData = initialConfig.workflow?.agentWorkflow || {
      agents: [],
      executionOrder: 'sequential' as const,
    };
    return workflowData;
  });
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => {
    const initialNodes: WorkflowNode[] = workflow.agents.map((agent, index) => ({
      id: agent.id,
      agent,
      x: 300,
      y: 150 + index * 180,
      connections: agent.outputTo || [],
    }));
    return initialNodes;
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string; type: 'node' | 'connection' } | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; point: ConnectionPoint } | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync nodes with workflow agents
  useEffect(() => {
    const existingNodeIds = new Set(nodes.map(n => n.id));
    const workflowAgentIds = new Set(workflow.agents.map(a => a.id));
    
    // Add new agents as nodes
    workflow.agents.forEach(agent => {
      if (!existingNodeIds.has(agent.id)) {
        const newNode: WorkflowNode = {
          id: agent.id,
          agent,
          x: 300,
          y: 150 + nodes.length * 180,
          connections: agent.outputTo || [],
        };
        setNodes(prev => [...prev, newNode]);
      }
    });

    // Remove deleted agents from nodes
    setNodes(prev => prev.filter(n => workflowAgentIds.has(n.id)));

    // Update node connections
    setNodes(prev => prev.map(node => {
      const agent = workflow.agents.find(a => a.id === node.id);
      return agent ? { ...node, connections: agent.outputTo || [] } : node;
    }));
  }, [workflow.agents.length]);

  const addAgent = (role: string) => {
    const newAgent: AgentDefinition = {
      id: `agent_${Date.now()}`,
      role: role as any,
      name: AGENT_ROLE_NAMES[role] || role,
      order: nodes.length + 1,
      temperature: 0.7,
    };

    const newNode: WorkflowNode = {
      id: newAgent.id,
      agent: newAgent,
      x: 300,
      y: 150 + nodes.length * 180,
      connections: [],
    };

    setNodes([...nodes, newNode]);
    setWorkflow({
      ...workflow,
      agents: [...workflow.agents, newAgent],
    });
    setShowAddAgent(false);
  };

  const removeAgent = (nodeId: string) => {
    // Remove connections to/from this node
    setWorkflow({
      ...workflow,
      agents: workflow.agents
        .filter((a: any) => a.id !== nodeId)
        .map((a: any) => ({
          ...a,
          inputFrom: a.inputFrom?.filter((id: string) => id !== nodeId) || [],
          outputTo: a.outputTo?.filter((id: string) => id !== nodeId) || [],
        }))
        .map((a, index) => ({ ...a, order: index + 1 })),
    });
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setContextMenu(null);
  };

  const getConnectionPoint = (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left'): ConnectionPoint | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const nodeWidth = 200;
    const nodeHeight = 80;
    let x = node.x;
    let y = node.y;

    switch (side) {
      case 'top':
        x += nodeWidth / 2;
        break;
      case 'right':
        x += nodeWidth;
        y += nodeHeight / 2;
        break;
      case 'bottom':
        x += nodeWidth / 2;
        y += nodeHeight;
        break;
      case 'left':
        y += nodeHeight / 2;
        break;
    }

    return { nodeId, side, x, y };
  };

  const handleConnectionStart = (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => {
    e.stopPropagation();
    const point = getConnectionPoint(nodeId, side);
    if (point) {
      setConnectingFrom({ nodeId, point });
    }
  };

  const handleConnectionEnd = (targetNodeId: string) => {
    if (connectingFrom && connectingFrom.nodeId !== targetNodeId) {
      connectNodes(connectingFrom.nodeId, targetNodeId);
    }
    setConnectingFrom(null);
    setTempConnectionEnd(null);
    setHoveredNode(null);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragging.offsetX;
      const y = e.clientY - rect.top - dragging.offsetY;

      setNodes(prev =>
        prev.map((node) =>
          node.id === dragging.nodeId ? { ...node, x: Math.max(0, x), y: Math.max(0, y) } : node
        )
      );
    }

    if (connectingFrom && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTempConnectionEnd({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, [dragging, connectingFrom]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (connectingFrom) {
      if (hoveredNode && hoveredNode !== connectingFrom.nodeId) {
        // Complete the connection
        handleConnectionEnd(hoveredNode);
      } else {
        // Connection not completed, cancel it
        setConnectingFrom(null);
        setTempConnectionEnd(null);
        setHoveredNode(null);
      }
    }
    setDragging(null);
  }, [connectingFrom, hoveredNode]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.target && (e.target as HTMLElement).closest('.connection-handle')) {
      return; // Don't drag if clicking on connection handle
    }
    if (connectingFrom) {
      return; // Don't drag if currently connecting
    }
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
    setSelectedNode(nodeId);
  };

  const connectNodes = (fromId: string, toId: string) => {
    if (fromId === 'start') {
      // Connect from Start Flow to an agent
      setWorkflow({
        ...workflow,
        agents: workflow.agents.map((agent) => {
          if (agent.id === toId) {
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
    } else {
      // Connect from one agent to another
      setWorkflow({
        ...workflow,
        agents: workflow.agents.map((agent) => {
          if (agent.id === fromId) {
            const existingOutputs = agent.outputTo || [];
            if (!existingOutputs.includes(toId)) {
              return {
                ...agent,
                outputTo: [...existingOutputs, toId],
              };
            }
          }
          if (agent.id === toId) {
            const existingInputs = agent.inputFrom || [];
            if (!existingInputs.includes(fromId)) {
              return {
                ...agent,
                inputFrom: [...existingInputs, fromId],
              };
            }
          }
          return agent;
        }),
      });

      setNodes(prev =>
        prev.map((node) => {
          if (node.id === fromId && !node.connections.includes(toId)) {
            return { ...node, connections: [...node.connections, toId] };
          }
          return node;
        })
      );
    }
  };

  const disconnectNodes = (fromId: string, toId: string) => {
    if (fromId === 'start') {
      // Disconnect from Start Flow
      setWorkflow({
        ...workflow,
        agents: workflow.agents.map((agent) => {
          if (agent.id === toId) {
            return {
              ...agent,
              inputFrom: agent.inputFrom?.filter(id => id !== 'start') || [],
            };
          }
          return agent;
        }),
      });
    } else {
      // Disconnect between agents
      setWorkflow({
        ...workflow,
        agents: workflow.agents.map((agent) => {
          if (agent.id === fromId) {
            return {
              ...agent,
              outputTo: agent.outputTo?.filter(id => id !== toId) || [],
            };
          }
          if (agent.id === toId) {
            return {
              ...agent,
              inputFrom: agent.inputFrom?.filter(id => id !== fromId) || [],
            };
          }
          return agent;
        }),
      });

      setNodes(prev =>
        prev.map((node) => {
          if (node.id === fromId) {
            return { ...node, connections: node.connections.filter(id => id !== toId) };
          }
          return node;
        })
      );
    }
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string, type: 'node' | 'connection') => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId, type });
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/templates/${templateId}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });

      if (!response.ok) throw new Error('Failed to save workflow');
      router.refresh();
      alert('Workflow saved successfully!');
    } catch (error) {
      alert('Failed to save workflow: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const sortedNodes = [...nodes].sort((a, b) => a.agent.order - b.agent.order);

  // Calculate all connections for rendering
  const allConnections: Array<{ from: ConnectionPoint; to: ConnectionPoint; fromId: string; toId: string }> = [];
  
  // Start Flow connections (if any)
  const startConnections = workflow.agents.filter(agent => 
    agent.inputFrom?.includes('start')
  );
  startConnections.forEach(agent => {
    const targetNode = nodes.find(n => n.id === agent.id);
    if (targetNode) {
      const fromPoint: ConnectionPoint = {
        nodeId: 'start',
        side: 'bottom',
        x: 300 + 80,
        y: 40 + 48,
      };
      const toPoint = getConnectionPoint(agent.id, 'top');
      if (toPoint) {
        allConnections.push({ from: fromPoint, to: toPoint, fromId: 'start', toId: agent.id });
      }
    }
  });

  // Node to node connections
  nodes.forEach((node: any) => {
    node.connections.forEach((targetId: string) => {
      const targetNode = nodes.find(n => n.id === targetId);
      if (targetNode) {
        const fromPoint = getConnectionPoint(node.id, 'bottom');
        const toPoint = getConnectionPoint(targetId, 'top');
        if (fromPoint && toPoint) {
          allConnections.push({ from: fromPoint, to: toPoint, fromId: node.id, toId: targetId });
        }
      }
    });
  });

  return (
    <div className="flex h-[calc(100vh-250px)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Left Sidebar - Dark Gray */}
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
          {sortedNodes.map((node) => (
            <div
              key={node.id}
              className={`bg-gray-700 rounded-lg p-3 mb-2 cursor-pointer transition-colors ${
                selectedNode === node.id ? 'bg-gray-600 ring-2 ring-orange-500' : 'hover:bg-gray-600'
              }`}
              onClick={() => setSelectedNode(node.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">{AGENT_ROLE_ICONS[node.agent.role] || '⚙️'}</span>
                  <span className="text-sm truncate">{node.agent.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, node.id, 'node');
                  }}
                  className="text-gray-400 hover:text-white flex-shrink-0 ml-2"
                >
                  ⋯
                </button>
              </div>
            </div>
          ))}
          {nodes.length === 0 && (
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
              {Object.entries(AGENT_ROLES).map(([key, value]) => (
                <button
                  key={value}
                  onClick={() => addAgent(value)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-600 rounded text-sm mb-1 flex items-center gap-2"
                >
                  <span>{AGENT_ROLE_ICONS[value]}</span>
                  <span>{AGENT_ROLE_NAMES[value]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div
        className="flex-1 relative bg-gray-100 overflow-auto select-none"
        ref={canvasRef}
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
        onMouseLeave={() => {
          if (connectingFrom) {
            setConnectingFrom(null);
            setTempConnectionEnd(null);
            setHoveredNode(null);
          }
        }}
        onMouseUp={(e) => {
          // Complete connection if hovering over a node
          if (connectingFrom && hoveredNode && hoveredNode !== connectingFrom.nodeId) {
            handleConnectionEnd(hoveredNode);
          } else if (connectingFrom) {
            // Cancel connection if not over a valid target
            setConnectingFrom(null);
            setTempConnectionEnd(null);
            setHoveredNode(null);
          }
        }}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(156, 163, 175, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* Start Node */}
        <div
          className="absolute z-10"
          style={{ left: 300, top: 40 }}
          onMouseEnter={() => {
            if (connectingFrom && connectingFrom.nodeId === 'start') {
              setHoveredNode('start');
            }
          }}
          onMouseLeave={() => {
            if (connectingFrom) {
              setHoveredNode(null);
            }
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            if (connectingFrom && connectingFrom.nodeId === 'start') {
              // Start node can't receive connections, only send them
              setConnectingFrom(null);
              setTempConnectionEnd(null);
              setHoveredNode(null);
            }
          }}
        >
          <div
            className={`bg-purple-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[160px] relative select-none ${
              connectingFrom?.nodeId === 'start' ? 'ring-2 ring-orange-400' : ''
            } ${hoveredNode === 'start' && connectingFrom ? 'ring-2 ring-green-400' : ''}`}
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span className="text-xl">⚡</span>
            <span className="font-medium">Start Flow</span>
            
            {/* Connection Handle - Bottom */}
            <div
              className="connection-handle absolute w-4 h-4 rounded-full bg-white border-2 border-gray-400 cursor-crosshair hover:border-orange-500 hover:bg-orange-100 transition-all select-none"
              style={{
                left: 'calc(50% - 8px)',
                top: 'calc(100% - 8px)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startPoint: ConnectionPoint = {
                  nodeId: 'start',
                  side: 'bottom',
                  x: 300 + 80, // center of start node
                  y: 40 + 48, // bottom of start node
                };
                setConnectingFrom({ nodeId: 'start', point: startPoint });
              }}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="Connect from Start Flow"
            />
          </div>
        </div>

        {/* Render Connections */}
        {allConnections.map((conn, index) => {
          const dx = conn.to.x - conn.from.x;
          const dy = conn.to.y - conn.from.y;
          const midX = (conn.from.x + conn.to.x) / 2;
          const midY = (conn.from.y + conn.to.y) / 2;

          return (
            <g key={`${conn.fromId}-${conn.toId}-${index}`}>
              <path
                d={`M ${conn.from.x} ${conn.from.y} Q ${midX} ${conn.from.y} ${midX} ${midY} T ${conn.to.x} ${conn.to.y}`}
                stroke="#9ca3af"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
                className="cursor-pointer hover:stroke-gray-600"
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleContextMenu(e as any, conn.fromId, 'connection');
                }}
              />
              {/* Connection delete button */}
              <circle
                cx={midX}
                cy={midY}
                r="8"
                fill="#ef4444"
                className="cursor-pointer hover:fill-red-600 opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  disconnectNodes(conn.fromId, conn.toId);
                }}
              />
            </g>
          );
        })}

        {/* Temporary connection line while dragging */}
        {connectingFrom && tempConnectionEnd && (
          <svg className="absolute pointer-events-none" style={{ width: '100%', height: '100%', zIndex: 50 }}>
            <path
              d={`M ${connectingFrom.point.x} ${connectingFrom.point.y} L ${tempConnectionEnd.x} ${tempConnectionEnd.y}`}
              stroke="#f97316"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
            />
          </svg>
        )}

        {/* Agent Nodes */}
        {sortedNodes.map((node) => {
          const connectionPoints = [
            getConnectionPoint(node.id, 'top'),
            getConnectionPoint(node.id, 'right'),
            getConnectionPoint(node.id, 'bottom'),
            getConnectionPoint(node.id, 'left'),
          ].filter(Boolean) as ConnectionPoint[];

          return (
            <div key={node.id}>
              {/* Node */}
              <div
                className={`absolute ${AGENT_COLORS[node.agent.role] || 'bg-gray-500'} text-white px-5 py-3 rounded-lg shadow-lg cursor-move min-w-[180px] z-10 select-none ${
                  selectedNode === node.id ? 'ring-2 ring-yellow-400' : ''
                } ${connectingFrom?.nodeId === node.id ? 'ring-2 ring-orange-400' : ''} ${
                  hoveredNode === node.id && connectingFrom ? 'ring-2 ring-green-400' : ''
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }}
                onMouseDown={(e) => {
                  if (!(e.target as HTMLElement).closest('.connection-handle')) {
                    handleMouseDown(node.id, e);
                  }
                }}
                onDragStart={(e) => {
                  if (!connectingFrom) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, node.id, 'node')}
                onMouseEnter={() => {
                  if (connectingFrom) {
                    setHoveredNode(node.id);
                  }
                }}
                onMouseLeave={() => {
                  if (connectingFrom) {
                    setHoveredNode(null);
                  }
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (connectingFrom && connectingFrom.nodeId !== node.id) {
                    handleConnectionEnd(node.id);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{AGENT_ROLE_ICONS[node.agent.role] || '⚙️'}</span>
                    <span className="font-medium text-sm">{node.agent.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="w-6 h-6 rounded hover:bg-black/20 flex items-center justify-center text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open settings modal
                      }}
                    >
                      ⚙️
                    </button>
                    <button
                      className="w-6 h-6 rounded hover:bg-black/20 flex items-center justify-center text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAgent(node.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="text-xs opacity-90 truncate">{node.agent.role}</div>

                {/* Connection Handles */}
                {connectionPoints.map((point, idx) => (
                  <div
                    key={`${point.side}-${idx}`}
                    className={`connection-handle absolute w-4 h-4 rounded-full bg-white border-2 border-gray-400 cursor-crosshair hover:border-orange-500 hover:bg-orange-100 transition-all select-none ${
                      connectingFrom?.nodeId === node.id ? 'ring-2 ring-orange-400' : ''
                    }`}
                    style={{
                      left: point.side === 'left' ? -8 : point.side === 'right' ? 'calc(100% - 8px)' : 'calc(50% - 8px)',
                      top: point.side === 'top' ? -8 : point.side === 'bottom' ? 'calc(100% - 8px)' : 'calc(50% - 8px)',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConnectionStart(node.id, point.side, e);
                    }}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    title={`Connect from ${point.side}`}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Arrow Marker Definition */}
        <svg className="absolute" style={{ width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#9ca3af" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed bg-white rounded-lg shadow-xl py-2 min-w-[150px] z-50 border border-gray-200"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'node' ? (
              <>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  ✏️ Rename
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  📄 Duplicate
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  📋 Copy
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                  onClick={() => {
                    removeAgent(contextMenu.nodeId);
                    setContextMenu(null);
                  }}
                >
                  🗑️ Delete
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setShowAddAgent(true);
                    setContextMenu(null);
                  }}
                >
                  ⬇️ Add Step
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  ⚡ Parallel Flow
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                  onClick={() => {
                    setContextMenu(null);
                  }}
                >
                  ➡️ Go To
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                  onClick={() => {
                    // Find and disconnect this connection
                    const node = nodes.find(n => n.id === contextMenu.nodeId);
                    if (node) {
                      // This would need connection ID, simplified for now
                    }
                    setContextMenu(null);
                  }}
                >
                  🗑️ Delete Connection
                </button>
              </>
            )}
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
        </>
      )}

      {/* Save Button */}
      <div className="absolute bottom-4 right-4 z-20">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium shadow-lg"
        >
          Save Workflow
        </button>
      </div>
    </div>
  );
}
