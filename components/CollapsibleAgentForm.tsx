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
    <div className="mb-6">
      <div className="flex items-center justify-end mb-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 bg-[#D1FE17] text-black rounded-lg hover:bg-[#B8E014] active:scale-95 transition-all duration-200 text-sm font-medium touch-manipulation flex items-center gap-1.5"
        >
          {isOpen ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Agent</span>
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="card">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
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
            <label htmlFor="role" className="block text-sm font-medium text-white mb-2">
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
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-white mb-2">
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
            <label htmlFor="prompt" className="block text-sm font-medium text-white mb-2">
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
            <label htmlFor="temperature" className="block text-sm font-medium text-white mb-2">
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
            <div className="text-sm text-red-400 bg-red-900/30 p-4 rounded-xl border border-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-[#D1FE17] bg-[#D1FE17]/20 p-4 rounded-xl border border-[#D1FE17]/50">
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
        </div>
      )}
    </div>
  );
}

