'use client';

import { useState } from 'react';
import TemplateForm from './TemplateForm';

interface CollapsibleTemplateFormProps {
  createTemplate: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  onToggle?: (isOpen: boolean) => void;
}

export default function CollapsibleTemplateForm({ createTemplate, onToggle }: CollapsibleTemplateFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <button
      onClick={handleToggle}
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
          <span>Create New Content Type</span>
        </>
      )}
    </button>
  );
}

// Separate component for the form that appears below
export function TemplateFormContainer({ createTemplate, isOpen, onClose }: { createTemplate: (formData: FormData) => Promise<{ error?: string; success?: boolean }>, isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div className="card mb-6">
      <TemplateForm createTemplate={createTemplate} onSuccess={onClose} />
    </div>
  );
}

