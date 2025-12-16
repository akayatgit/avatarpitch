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
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 transition-all font-medium shadow-md touch-manipulation min-h-[44px]"
          >
            + Create New Template
          </button>
        </div>
      )}

      {isOpen && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Create Template</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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

