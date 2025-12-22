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
        <p className="text-sm text-gray-400">No agents found. Create your first agent above.</p>
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
                <label className="block text-sm font-medium text-white mb-2">Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={agent.name}
                  required
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Role *</label>
                <input
                  type="text"
                  name="role"
                  defaultValue={agent.role}
                  required
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                <label className="block text-sm font-medium text-white mb-2">Task Prompt</label>
                <textarea
                  name="prompt"
                  defaultValue={agent.prompt || ''}
                  rows={2}
                  className="input-field text-sm resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white flex-1">
                    {agent.name}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(agent)}
                      className="p-2 bg-[#D1FE17] text-black rounded-lg hover:bg-[#B8E014] active:scale-95 transition-all duration-200 touch-manipulation"
                      title="Edit agent"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      disabled={deletingId === agent.id}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all duration-200 disabled:opacity-50 touch-manipulation"
                      title="Delete agent"
                    >
                      {deletingId === agent.id ? (
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {agent.system_prompt && (
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {agent.system_prompt}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

