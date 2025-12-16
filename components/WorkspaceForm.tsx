'use client';

import { useState, useRef } from 'react';

interface WorkspaceFormProps {
  createWorkspace: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export default function WorkspaceForm({ createWorkspace }: WorkspaceFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createWorkspace(formData);

    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setSuccess(true);
      if (formRef.current) {
        formRef.current.reset();
      }
      setTimeout(() => setSuccess(false), 3000);
    }

    setLoading(false);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Workspace Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3.5 min-h-[44px] touch-manipulation"
            placeholder="e.g., winterwears"
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-600 bg-green-50 p-4 rounded-xl border border-green-200">
            Workspace created successfully!
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-purple-600 active:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all touch-manipulation min-h-[44px]"
        >
          {loading ? 'Creating...' : 'Create Workspace'}
        </button>
      </div>
    </form>
  );
}

