'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
  template_id: string | null;
  templates: Array<{ id: string; name: string }> | null;
}

interface Template {
  id: string;
  name: string;
}

interface WorkspaceListProps {
  workspaces: Workspace[];
  templates: Template[];
  updateWorkspaceTemplate: (
    workspaceId: string,
    templateId: string | null
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function WorkspaceList({
  workspaces,
  templates,
  updateWorkspaceTemplate,
}: WorkspaceListProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [localTemplateIds, setLocalTemplateIds] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    workspaces.forEach((ws) => {
      initial[ws.id] = ws.template_id;
    });
    return initial;
  });

  const handleTemplateChange = async (workspaceId: string, templateId: string) => {
    const newTemplateId = templateId || null;
    
    // Optimistically update local state
    setLocalTemplateIds({ ...localTemplateIds, [workspaceId]: newTemplateId });
    setUpdating({ ...updating, [workspaceId]: true });
    setMessages({ ...messages, [workspaceId]: '' });

    const result = await updateWorkspaceTemplate(workspaceId, newTemplateId);

    setUpdating({ ...updating, [workspaceId]: false });
    if (result.error) {
      // Revert on error
      setLocalTemplateIds({ ...localTemplateIds, [workspaceId]: workspaces.find(w => w.id === workspaceId)?.template_id || null });
      setMessages({ ...messages, [workspaceId]: result.error });
    } else {
      setMessages({ ...messages, [workspaceId]: 'Template updated!' });
      setTimeout(() => {
        setMessages({ ...messages, [workspaceId]: '' });
      }, 2000);
      // Refresh the page data
      router.refresh();
    }
  };

  if (workspaces.length === 0) {
    return <p className="text-sm text-gray-500">No workspaces yet. Create one above.</p>;
  }

  return (
    <div className="space-y-3">
      {workspaces.map((workspace) => {
        const currentTemplate = workspace.templates && Array.isArray(workspace.templates) && workspace.templates.length > 0
          ? workspace.templates[0]
          : null;

        return (
          <div key={workspace.id} className="border border-gray-200 rounded-xl p-4 active:bg-gray-50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-gray-900 mb-1">{workspace.name}</h3>
                <p className="text-sm text-gray-500">
                  Template:{' '}
                  {localTemplateIds[workspace.id]
                    ? templates.find((t) => t.id === localTemplateIds[workspace.id])?.name || 'None'
                    : currentTemplate
                    ? currentTemplate.name
                    : 'None'}
                </p>
                {messages[workspace.id] && (
                  <p
                    className={`text-sm mt-1 ${
                      messages[workspace.id].includes('error')
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {messages[workspace.id]}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <select
                  value={localTemplateIds[workspace.id] || ''}
                  onChange={(e) => handleTemplateChange(workspace.id, e.target.value)}
                  disabled={updating[workspace.id]}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3 min-h-[44px] touch-manipulation"
                >
                  <option value="">Select template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

