import { supabaseAdmin } from '@/lib/supabaseAdmin';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import { generateProject } from '../actions';
import CreateProjectForm from '@/components/CreateProjectForm';
import ProjectResults from '@/components/ProjectResults';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CreateProjectPage() {
  try {
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('templates')
      .select('id, name')
      .order('name', { ascending: true });

    if (templatesError && isSupabaseNetworkError(templatesError)) {
      return <NetworkError message="Unable to load templates. Please check your internet connection." />;
    }

    return (
      <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Create Project</h1>
          <p className="text-sm text-gray-600">Generate a new video project using AI-powered templates</p>
        </div>

        {(templates || []).length === 0 ? (
          <div className="bg-accent-50 border border-accent-200 rounded-xl p-4">
            <p className="text-sm text-accent-800">
              No templates found. Please create a template first.
            </p>
          </div>
        ) : (
          <CreateProjectForm templates={templates || []} generateProject={generateProject} />
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

