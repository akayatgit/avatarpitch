'use client';

import CreateProjectForm from '@/components/content-creation/generation/CreateProjectForm';

interface CreateProjectPageClientProps {
  templates: Array<{ id: string; name: string }>;
  generateProject: (formData: FormData) => Promise<any>;
  preselectedContentTypeId?: string;
}

export default function CreateProjectPageClient({
  templates,
  generateProject,
  preselectedContentTypeId,
}: CreateProjectPageClientProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Start generating</h1>
      </div>

      {(templates || []).length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-300">
            No content types found. Please create a content type first.
          </p>
        </div>
      ) : (
        <CreateProjectForm
          templates={templates || []}
          generateProject={generateProject}
          preselectedContentTypeId={preselectedContentTypeId}
        />
      )}
    </div>
  );
}
