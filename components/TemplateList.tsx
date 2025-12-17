'use client';

import { useState } from 'react';
import Link from 'next/link';
import WorkflowPreview from './WorkflowPreview';
import { type AgentWorkflow } from '@/lib/agents';

interface Template {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  config?: any;
}

interface TemplateListProps {
  templates: Template[];
}

export default function TemplateList({ templates }: TemplateListProps) {
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewWorkflow, setPreviewWorkflow] = useState<AgentWorkflow | null>(null);

  if (templates.length === 0) {
    return <p className="text-sm text-gray-500">No templates yet. Create one above.</p>;
  }

  const getTemplateIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ugc') || lowerName.includes('product')) return '🎬';
    if (lowerName.includes('studio') || lowerName.includes('minimal')) return '🎨';
    if (lowerName.includes('before') || lowerName.includes('after') || lowerName.includes('story')) return '📖';
    return '📄';
  };

  const handlePreviewWorkflow = (template: Template) => {
    const workflow = template.config?.workflow?.agentWorkflow || null;
    setPreviewWorkflow(workflow);
    setPreviewTemplateId(template.id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template: any) => (
        <div
          key={template.id}
          className="card cursor-pointer group hover:shadow-md transition-all duration-200 active:scale-[0.98] touch-manipulation"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl sm:text-5xl">{getTemplateIcon(template.name)}</div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(template.created_at).toLocaleDateString()}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/app/templates/${template.id}`}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Edit
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewWorkflow(template);
                }}
                className="text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 active:bg-primary-300 transition-colors duration-200 font-medium"
              >
                Preview Workflow
              </button>
            </div>
          </div>
        </div>
      ))}

      {previewTemplateId && (
        <WorkflowPreview
          templateId={previewTemplateId}
          workflow={previewWorkflow}
          onClose={() => {
            setPreviewTemplateId(null);
            setPreviewWorkflow(null);
          }}
        />
      )}
    </div>
  );
}

