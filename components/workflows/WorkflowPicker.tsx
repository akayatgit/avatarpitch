'use client';

import { useState } from 'react';
import { listWorkflows } from '@/lib/workflows/registry';
import type { WorkflowId } from '@/lib/workflows/types';
import ContinuousShotStudio from './continuous-shot-path/ContinuousShotStudio';
import DroneTracingShotStudio from './drone-tracing-shot/DroneTracingShotStudio';

/**
 * Avatar picks a Master Prompt template (workflow), then runs its tool order.
 */
export default function WorkflowPicker() {
  const [selected, setSelected] = useState<WorkflowId | null>(null);
  const workflows = listWorkflows();

  if (selected === 'drone-tracing-shot') {
    return <DroneTracingShotStudio onBack={() => setSelected(null)} />;
  }
  if (selected === 'continuous-shot-path') {
    return <ContinuousShotStudio onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Choose a template</h2>
        <p className="text-sm text-gray-400">
          Each template starts with inspiration + a minimalist one-twist idea, then runs shared tools
          in Master Prompt order — sparse, mind-bending stills, not crowded landscapes.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows.map((wf) => (
          <button
            key={wf.id}
            type="button"
            onClick={() => setSelected(wf.id)}
            className="text-left card border border-gray-800 hover:border-[#D1FE17] transition-colors p-5"
          >
            <h3 className="text-base font-semibold text-white mb-2">{wf.name}</h3>
            <p className="text-sm text-gray-400 mb-4">{wf.description}</p>
            <ol className="text-xs text-gray-500 space-y-1 mb-4">
              {wf.steps.map((s, i) => (
                <li key={s.id}>
                  {i + 1}. {s.label}{' '}
                  <span className="text-gray-600">({s.tool})</span>
                </li>
              ))}
            </ol>
            <span className="text-sm font-medium text-[#D1FE17]">Open workflow →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
