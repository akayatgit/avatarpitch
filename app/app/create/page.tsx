import { supabaseAdmin } from '@/lib/supabaseAdmin';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import { generateProject } from '../actions';
import CreateProjectForm from '@/components/content-creation/generation/CreateProjectForm';
import ProjectResults from '@/components/content-creation/ProjectResults';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CreateProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  try {
    const resolvedSearchParams = await searchParams;
    const preselectedContentTypeId = resolvedSearchParams?.contentTypeId as string | undefined;

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('content_types')
      .select('id, name')
      .order('name', { ascending: true });

    if (templatesError && isSupabaseNetworkError(templatesError)) {
      return <NetworkError message="Unable to load content types. Please check your internet connection." />;
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
  } catch (error: any) {
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    throw error;
  }
}

