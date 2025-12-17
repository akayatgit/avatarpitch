'use client';

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  role: string;
  order: number;
}

interface AgentProgressFlowProps {
  agents: Agent[];
  currentAgentId: string | null;
  completedAgents: Set<string>;
  agentResponses: Map<string, any>;
  currentScene?: number;
  totalScenes?: number;
  isFinalizing?: boolean;
  onAgentClick?: (agentId: string, response: any) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export default function AgentProgressFlow({
  agents,
  currentAgentId,
  completedAgents,
  agentResponses,
  currentScene,
  totalScenes,
  isFinalizing,
  onAgentClick,
  onClose,
  isOpen,
}: AgentProgressFlowProps) {
  const sortedAgents = [...agents].sort((a, b) => a.order - b.order);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  // Calculate positions for compact horizontal flow
  const nodeWidth = 80;
  const nodeHeight = 60;
  const spacing = 100;
  const startX = 20;
  const startY = 10; // Reduced from 50 to minimize top spacing

  const getAgentStatus = (agentId: string) => {
    if (currentAgentId === agentId) return 'running';
    if (completedAgents.has(agentId)) return 'completed';
    return 'pending';
  };

  const getAgentColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-primary-500 border-primary-600';
      case 'completed':
        return 'bg-green-500 border-green-600';
      default:
        return 'bg-gray-300 border-gray-400';
    }
  };

  const getConnectorColor = (fromStatus: string, toStatus: string) => {
    if (fromStatus === 'completed' && (toStatus === 'running' || toStatus === 'completed')) {
      return 'stroke-green-500';
    }
    if (fromStatus === 'completed' && toStatus === 'pending') {
      return 'stroke-purple-400';
    }
    return 'stroke-gray-300';
  };

  const isConnectorActive = (fromStatus: string, toStatus: string) => {
    return fromStatus === 'completed' && toStatus === 'running';
  };

  if (sortedAgents.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Agent Progress</h3>
            {currentScene && totalScenes && !isFinalizing && (
              <p className="text-sm text-gray-600 mt-1">
                Generating Scene {currentScene} of {totalScenes}
              </p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {isFinalizing ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-lg text-gray-700 font-medium">Crafting your Prompts...</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ minHeight: '100px', minWidth: `${sortedAgents.length * spacing + 40}px` }}>
            {/* SVG for connectors */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ height: '100px' }}
            >
              <defs>
                <style>{`
                  @keyframes flow {
                    0% { offset-distance: 0%; }
                    100% { offset-distance: 100%; }
                  }
                  .flow-dot {
                    animation: flow 1.5s linear infinite;
                  }
                `}</style>
              </defs>
              {sortedAgents.slice(0, -1).map((agent, idx) => {
                const fromStatus = getAgentStatus(agent.id);
                const toAgent = sortedAgents[idx + 1];
                const toStatus = getAgentStatus(toAgent.id);
                const fromX = startX + idx * spacing + nodeWidth;
                const fromY = startY + nodeHeight / 2;
                const toX = startX + (idx + 1) * spacing;
                const toY = startY + nodeHeight / 2;
                const isActive = isConnectorActive(fromStatus, toStatus);
                const color = getConnectorColor(fromStatus, toStatus);
                const pathLength = toX - fromX;

                return (
                  <g key={`connector-${agent.id}-${toAgent.id}`}>
                    {/* Base line */}
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray={isActive ? '4 4' : 'none'}
                      className={isActive ? 'animate-pulse' : ''}
                    />
                    {/* Animated flow indicator */}
                    {isActive && (
                      <circle
                        r="3"
                        fill="#9333ea"
                        className="flow-dot"
                      >
                        <animateMotion
                          dur="1.5s"
                          repeatCount="indefinite"
                          path={`M ${fromX} ${fromY} L ${toX} ${toY}`}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Agent nodes */}
            <div className="relative flex items-center" style={{ height: '100px' }}>
              {sortedAgents.map((agent, idx) => {
                const status = getAgentStatus(agent.id);
                const isRunning = status === 'running';
                const isCompleted = status === 'completed';
                const hasResponse = agentResponses.has(agent.id);
                const x = startX + idx * spacing;

                return (
                  <div
                    key={agent.id}
                    className="absolute flex flex-col items-center cursor-pointer group"
                    style={{ left: `${x}px`, top: `${startY}px` }}
                    onClick={() => {
                      if (hasResponse) {
                        setSelectedAgent(agent.id);
                        onAgentClick?.(agent.id, agentResponses.get(agent.id));
                      }
                    }}
                  >
                    {/* Node */}
                    <div
                      className={`
                        ${getAgentColor(status)}
                        ${isRunning ? 'animate-pulse ring-4 ring-purple-300' : ''}
                        ${isCompleted ? 'ring-2 ring-green-300' : ''}
                        ${hasResponse ? 'hover:scale-110' : ''}
                        w-20 h-15 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-300 shadow-md
                      `}
                      style={{ width: `${nodeWidth}px`, height: `${nodeHeight}px` }}
                    >
                      <div className="text-[10px] font-semibold text-white text-center px-1 leading-tight">
                        {agent.name}
                      </div>
                      {isRunning && (
                        <div className="mt-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        </div>
                      )}
                      {isCompleted && (
                        <div className="mt-1">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Role label */}
                    <div className="mt-1 text-[9px] text-gray-600 text-center max-w-[80px] truncate">
                      {agent.role.replace('_', ' ')}
                    </div>
                    {/* Click indicator */}
                    {hasResponse && (
                      <div className="mt-0.5 text-[8px] text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to view
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Agent Response Dialog */}
        {selectedAgent && agentResponses.has(selectedAgent) && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {sortedAgents.find(a => a.id === selectedAgent)?.name} Response
                </h3>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                  {JSON.stringify(agentResponses.get(selectedAgent), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

