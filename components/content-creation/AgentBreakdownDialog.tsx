'use client';

import { useState } from 'react';

interface AgentContribution {
  agentId: string;
  agentName: string;
  agentRole: string;
  order: number;
  contribution: any;
  writesTo: string[];
}

interface FinalAssembler {
  agentId: string;
  agentName: string;
  agentRole: string;
  sharedStateUsed: any;
}

interface AgentBreakdownDialogProps {
  sceneIndex: number;
  sceneType: string;
  finalPrompt: string;
  agentContributions?: AgentContribution[];
  finalAssembler?: FinalAssembler;
  onClose: () => void;
}

export default function AgentBreakdownDialog({
  sceneIndex,
  sceneType,
  finalPrompt,
  agentContributions = [],
  finalAssembler,
  onClose,
}: AgentBreakdownDialogProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Agent Breakdown: Scene {sceneIndex}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Type: {sceneType}</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Final Prompt */}
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">Final Image Prompt</h3>
          <p className="text-sm text-purple-800">{finalPrompt}</p>
        </div>

        {/* Agent Contributions */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Agent Contributions (Sequential Workflow)
          </h3>
          <div className="space-y-3">
            {agentContributions
              .sort((a: any, b: any) => a.order - b.order)
              .map((contrib: any) => (
                <div
                  key={contrib.agentId}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedAgent(
                        expandedAgent === contrib.agentId ? null : contrib.agentId
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded">
                        #{contrib.order}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {contrib.agentName}
                        </h4>
                        <p className="text-xs text-gray-600">{contrib.agentRole}</p>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedAgent === contrib.agentId ? '▼' : '▶'}
                    </button>
                  </div>
                  {expandedAgent === contrib.agentId && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="mb-2">
                        <span className="text-xs font-medium text-gray-700">Writes To:</span>
                        <span className="text-xs text-gray-600 ml-2">
                          {contrib.writesTo.join(', ')}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-700">Contribution:</span>
                        <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto border border-gray-200">
                          {JSON.stringify(contrib.contribution, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Final Assembler */}
        {finalAssembler && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Final Assembler: {finalAssembler.agentName}
            </h3>
            <p className="text-xs text-blue-700 mb-2">Role: {finalAssembler.agentRole}</p>
            <details className="mt-2">
              <summary className="text-xs font-medium text-blue-800 cursor-pointer">
                View Shared State Used
              </summary>
              <pre className="text-xs bg-white p-2 rounded mt-2 overflow-x-auto border border-blue-200">
                {JSON.stringify(finalAssembler.sharedStateUsed, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* How Final Prompt Was Created */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            How the Final Prompt Was Created
          </h3>
          <p className="text-xs text-gray-700 leading-relaxed">
            The final image prompt for this scene was created through a sequential multi-agent
            workflow:
          </p>
          <ol className="list-decimal list-inside text-xs text-gray-700 mt-2 space-y-1">
            {agentContributions
              .sort((a, b) => a.order - b.order)
              .map((contrib, idx) => (
                <li key={contrib.agentId}>
                  <strong>{contrib.agentName}</strong> ({contrib.agentRole}) contributed to the
                  shared state, writing to: {contrib.writesTo.join(', ')}
                </li>
              ))}
            {finalAssembler && (
              <li>
                <strong>{finalAssembler.agentName}</strong> (Final Assembler) synthesized all
                agent contributions from the shared state to create the final scene prompt.
              </li>
            )}
          </ol>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

