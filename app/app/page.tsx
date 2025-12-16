import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { bootstrap } from './actions';
import Link from 'next/link';
import NetworkError from '@/components/NetworkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  let bootstrapError: Error | null = null;
  
  try {
    await bootstrap();
  } catch (error: any) {
    bootstrapError = error;
    // If it's a network error, show the network error component
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    // For other errors, re-throw to show Next.js error page
    throw error;
  }

  const { data: workspaces } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, template_id')
    .order('created_at', { ascending: false });

  const { data: defaultWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, template_id')
    .eq('name', 'default')
    .single();

  const selectedWorkspace = defaultWorkspace || (workspaces && workspaces[0]);

  // Fetch template name if template_id exists
  let templateName: string | null = null;
  if (selectedWorkspace?.template_id) {
    const { data: template } = await supabaseAdmin
      .from('templates')
      .select('name')
      .eq('id', selectedWorkspace.template_id)
      .single();
    templateName = template?.name || null;
  }

  // Get stats (mock for now, can be enhanced later)
  const stats = [
    { name: 'Projects Generated', value: '0', icon: '🎬' },
    { name: 'Workspaces', value: String(workspaces?.length || 0), icon: '📁' },
    { name: 'Templates', value: '3', icon: '📄' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/app/create"
          className="inline-flex items-center justify-center px-6 py-3.5 bg-purple-600 text-white rounded-xl active:bg-purple-700 active:scale-95 transition-all font-medium shadow-md touch-manipulation min-h-[44px]"
        >
          + Create new project
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-gray-200 active:scale-98 transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">{stat.name}</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className="text-3xl sm:text-4xl ml-4">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Info Card */}
      <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Current Workspace</h2>
        {selectedWorkspace ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-sm font-medium text-gray-700">Workspace:</span>
              <span className="text-sm text-gray-900">{selectedWorkspace.name}</span>
            </div>
            {templateName ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-sm font-medium text-gray-700">Template:</span>
                <span className="text-sm text-gray-900">{templateName}</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                <span className="text-sm text-yellow-600">
                  No template assigned. Please assign one in{' '}
                  <Link
                    href="/app/workspaces"
                    className="underline font-medium active:text-yellow-700"
                  >
                    Workspaces
                  </Link>
                  .
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No workspace selected</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Link
          href="/app/workspaces"
          className="inline-flex items-center justify-center px-6 py-3.5 border border-gray-300 text-gray-700 bg-white rounded-xl active:bg-gray-50 active:scale-95 transition-all font-medium shadow-sm touch-manipulation min-h-[44px]"
        >
          Manage Workspaces
        </Link>
        <Link
          href="/app/templates"
          className="inline-flex items-center justify-center px-6 py-3.5 border border-gray-300 text-gray-700 bg-white rounded-xl active:bg-gray-50 active:scale-95 transition-all font-medium shadow-sm touch-manipulation min-h-[44px]"
        >
          Manage Templates
        </Link>
      </div>
    </div>
  );
}

