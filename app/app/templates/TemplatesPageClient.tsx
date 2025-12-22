'use client';

import { useState } from 'react';
import TemplateList from '@/components/TemplateList';
import CollapsibleTemplateForm, { TemplateFormContainer } from '@/components/CollapsibleTemplateForm';

interface TemplatesPageClientProps {
  templates: any[];
  createTemplate: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export default function TemplatesPageClient({ templates, createTemplate }: TemplatesPageClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-white">All Content Types</h2>
          <CollapsibleTemplateForm createTemplate={createTemplate} onToggle={setIsFormOpen} />
        </div>
      </div>

      <TemplateFormContainer createTemplate={createTemplate} isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />

      <TemplateList templates={templates || []} />
    </>
  );
}

