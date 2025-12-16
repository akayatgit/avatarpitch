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
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">Create Agent</h2>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm sm:text-base touch-manipulation min-h-[44px]"
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      {isOpen && (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Agent Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base touch-manipulation min-h-[44px]"
              placeholder="e.g., Fashion Expert"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
              Role *
            </label>
            <input
              type="text"
              id="role"
              name="role"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base touch-manipulation min-h-[44px]"
              placeholder="e.g., fashion_expert"
            />
          </div>

          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-1.5">
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base resize-y touch-manipulation"
              placeholder="You are a fashion expert with deep knowledge..."
            />
          </div>

          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1.5">
              Task Prompt
            </label>
            <textarea
              id="prompt"
              name="prompt"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base resize-y touch-manipulation"
              placeholder="Analyze the product and produce insights..."
            />
          </div>

          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1.5">
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base touch-manipulation min-h-[44px]"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">Agent created successfully!</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
          >
            {isSubmitting ? 'Creating...' : 'Create Agent'}
          </button>
        </form>
      )}
    </div>
  );
}

