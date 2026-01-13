'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CreateProjectForm from '@/components/content-creation/generation/CreateProjectForm';
import ProjectResults from '@/components/content-creation/ProjectResults';

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
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/app/create')}`);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

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

