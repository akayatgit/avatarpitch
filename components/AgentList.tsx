'use client';

import { useState } from 'react';
import { updateAgent, deleteAgent } from '../app/app/actions';
import { useRouter } from 'next/navigation';

interface Agent {
  id: string;
  name: string;
  role: string;
  system_prompt: string | null;
  prompt: string | null;
  temperature: number;
  created_at: string;
  updated_at: string;
}

interface AgentListProps {
  agents: Agent[];
  updateAgent: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  deleteAgent: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
}

export default function AgentList({ agents, updateAgent, deleteAgent }: AgentListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>, agent: Agent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('id', agent.id);

    const result = await updateAgent(formData);
    if (result.success) {
      setEditingId(null);
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    setDeletingId(id);
    const formData = new FormData();
    formData.append('id', id);

    const result = await deleteAgent(formData);
    if (result.success) {
      router.refresh();
    }
    setDeletingId(null);
  };

  if (agents.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-gray-600">No agents found. Create your first agent above.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent: any) => (
        <div
          key={agent.id}
          className="card"
        >
          {editingId === agent.id ? (
            <form onSubmit={(e) => handleSave(e, agent)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={agent.name}
                  required
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <input
                  type="text"
                  name="role"
                  defaultValue={agent.role}
                  required
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt
                </label>
                <textarea
                  name="systemPrompt"
                  defaultValue={agent.system_prompt || ''}
                  rows={3}
                  className="input-field text-sm resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Prompt</label>
                <textarea
                  name="prompt"
                  defaultValue={agent.prompt || ''}
                  rows={2}
                  className="input-field text-sm resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature
                </label>
                <input
                  type="number"
                  name="temperature"
                  defaultValue={agent.temperature}
                  min="0"
                  max="2"
                  step="0.1"
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 btn-primary text-sm py-2.5"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 btn-secondary text-sm py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {agent.name}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">Role:</span> {agent.role}
                </p>
                {agent.system_prompt && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {agent.system_prompt}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Temp: {agent.temperature} | Created:{' '}
                  {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(agent)}
                  className="flex-1 px-4 py-2.5 bg-primary-100 text-primary-700 rounded-xl hover:bg-primary-200 active:scale-95 transition-all duration-200 text-sm font-medium touch-manipulation min-h-[44px]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  disabled={deletingId === agent.id}
                  className="flex-1 px-4 py-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 active:scale-95 transition-all duration-200 text-sm font-medium disabled:opacity-50 touch-manipulation min-h-[44px]"
                >
                  {deletingId === agent.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

