'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AGENT_ROLES, type AgentWorkflow } from '@/lib/agents';

interface WorkflowPreviewProps {
  templateId: string;
  workflow: AgentWorkflow | null;
  onClose: () => void;
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

export default function WorkflowPreview({ templateId, workflow, onClose }: WorkflowPreviewProps) {
  if (!workflow || !workflow.agents || workflow.agents.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Workflow Preview</h2>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No agent workflow configured for this template.</p>
            <Link
              href={`/app/templates/${templateId}/workflow`}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
              onClick={onClose}
            >
              Configure Workflow
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sortedAgents = [...workflow.agents].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Workflow Preview</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-gray-700">Execution Order:</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
              {workflow.executionOrder === 'sequential' ? 'Sequential' : workflow.executionOrder === 'parallel' ? 'Parallel' : 'Custom'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {sortedAgents.map((agent, index) => (
            <div
              key={agent.id}
              className="border border-gray-200 rounded-xl p-4 bg-gray-50"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-gray-500">#{agent.order}</span>
                <h3 className="text-base font-semibold text-gray-900">{agent.name}</h3>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                  {AGENT_ROLE_NAMES[agent.role] || agent.role}
                </span>
              </div>
              {agent.inputFrom && agent.inputFrom.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600">
                    Receives input from: {agent.inputFrom.map(id => {
                      const fromAgent = workflow.agents.find(a => a.id === id);
                      return fromAgent?.name || id;
                    }).join(', ')}
                  </p>
                </div>
              )}
              {agent.outputTo && agent.outputTo.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-gray-600">
                    Sends output to: {agent.outputTo.map(id => {
                      const toAgent = workflow.agents.find(a => a.id === id);
                      return toAgent?.name || id;
                    }).join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
          <Link
            href={`/app/templates/${templateId}/workflow`}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
            onClick={onClose}
          >
            Edit Workflow
          </Link>
        </div>
      </div>
    </div>
  );
}

