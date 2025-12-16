import { supabaseAdmin } from '@/lib/supabaseAdmin';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import { createWorkspace, updateWorkspaceTemplate } from '../actions';
import WorkspaceForm from '@/components/WorkspaceForm';
import WorkspaceList from '@/components/WorkspaceList';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspacesPage() {
  const { data: workspaces, error: workspacesError } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, template_id, templates(id, name)')
    .order('created_at', { ascending: false });

  if (workspacesError && isSupabaseNetworkError(workspacesError)) {
    return <NetworkError message="Unable to load workspaces. Please check your internet connection." />;
  }

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('templates')
    .select('id, name')
    .order('name', { ascending: true });

  if (templatesError && isSupabaseNetworkError(templatesError)) {
    return <NetworkError message="Unable to load templates. Please check your internet connection." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 lg:mb-8">Workspaces</h1>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Create Workspace</h2>
        <WorkspaceForm createWorkspace={createWorkspace} />
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">All Workspaces</h2>
        <WorkspaceList
          workspaces={workspaces || []}
          templates={templates || []}
          updateWorkspaceTemplate={updateWorkspaceTemplate}
        />
      </div>
    </div>
  );
}

