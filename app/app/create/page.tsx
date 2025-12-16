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
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, template_id')
      .order('created_at', { ascending: false });

    if (workspacesError && isSupabaseNetworkError(workspacesError)) {
      return <NetworkError message="Unable to load workspaces. Please check your internet connection." />;
    }

    // Filter workspaces that have templates assigned
    const workspacesWithTemplates = (workspaces || []).filter((w) => w.template_id);

    // Fetch template names for each workspace
    const validWorkspaces = await Promise.all(
    workspacesWithTemplates.map(async (workspace) => {
      if (!workspace.template_id) return null;

      const { data: template, error: templateError } = await supabaseAdmin
        .from('templates')
        .select('id, name')
        .eq('id', workspace.template_id)
        .single();

      if (templateError && isSupabaseNetworkError(templateError)) {
        throw new Error('NETWORK_ERROR: Unable to load templates. Please check your internet connection.');
      }

      if (!template) return null;

      return {
        id: workspace.id,
        name: workspace.name,
        template_id: workspace.template_id,
        templates: [{ id: template.id, name: template.name }],
      };
    })
  );

    // Filter out any null results
    const filteredWorkspaces = validWorkspaces.filter((w) => w !== null) as Array<{
      id: string;
      name: string;
      template_id: string;
      templates: Array<{ id: string; name: string }>;
    }>;

    return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 lg:mb-8">Create Project</h1>

      {filteredWorkspaces.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            No workspaces with templates found. Please create a workspace and assign a template
            first.
          </p>
        </div>
      ) : (
        <CreateProjectForm workspaces={filteredWorkspaces} generateProject={generateProject} />
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

