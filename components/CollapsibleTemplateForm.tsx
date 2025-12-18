'use client';

import { useState } from 'react';
import TemplateForm from './TemplateForm';

interface CollapsibleTemplateFormProps {
  createTemplate: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export default function CollapsibleTemplateForm({ createTemplate }: CollapsibleTemplateFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <div className="mb-6">
          <button
            onClick={() => setIsOpen(true)}
            className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>+</span>
            <span>Create New Content Type</span>
          </button>
        </div>
      )}

      {isOpen && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Create Content Type</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              ✕ Close
            </button>
          </div>
          <TemplateForm createTemplate={createTemplate} onSuccess={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}

