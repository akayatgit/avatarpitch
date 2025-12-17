'use client';

import { useState, useRef } from 'react';
import { createAgent } from '@/app/app/actions';

interface CollapsibleAgentFormProps {
  createAgent: (formData: FormData) => Promise<{ success?: boolean; error?: string; data?: any }>;
}

export default function CollapsibleAgentForm({ createAgent }: CollapsibleAgentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await createAgent(formData);

    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setSuccess(true);
      if (formRef.current) {
        formRef.current.reset();
      }
      setIsOpen(false);
      setTimeout(() => setSuccess(false), 3000);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Agent</h2>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="btn-primary text-sm min-h-[44px]"
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      {isOpen && (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="input-field min-h-[44px] touch-manipulation"
              placeholder="e.g., Fashion Expert"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <input
              type="text"
              id="role"
              name="role"
              required
              className="input-field min-h-[44px] touch-manipulation"
              placeholder="e.g., fashion_expert"
            />
          </div>

          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              rows={4}
              className="input-field resize-y touch-manipulation"
              placeholder="You are a fashion expert with deep knowledge..."
            />
          </div>

          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Task Prompt
            </label>
            <textarea
              id="prompt"
              name="prompt"
              rows={3}
              className="input-field resize-y touch-manipulation"
              placeholder="Analyze the product and produce insights..."
            />
          </div>

          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
              Temperature (0-2)
            </label>
            <input
              type="number"
              id="temperature"
              name="temperature"
              min="0"
              max="2"
              step="0.1"
              defaultValue="0.7"
              className="input-field min-h-[44px] touch-manipulation"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-primary-600 bg-primary-50 p-4 rounded-xl border border-primary-200">
              Agent created successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? 'Creating...' : 'Create Agent'}
          </button>
        </form>
      )}
    </div>
  );
}

