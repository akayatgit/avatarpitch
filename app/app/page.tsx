import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { bootstrap } from './actions';
import Link from 'next/link';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  console.log('[Dashboard] Function started');
  let bootstrapError: Error | null = null;
  
  try {
    console.log('[Dashboard] Calling bootstrap()...');
    await bootstrap();
    console.log('[Dashboard] bootstrap() completed successfully');
  } catch (error: any) {
    console.error('[Dashboard] bootstrap() error:', error);
    bootstrapError = error;
    // If it's a network error, show the network error component
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      console.log('[Dashboard] Returning NetworkError component');
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    // For other errors, re-throw to show Next.js error page
    console.error('[Dashboard] Re-throwing bootstrap error');
    throw error;
  }

  // Fetch workspaces with error handling
  console.log('[Dashboard] Fetching workspaces...');
  let workspaces: any[] | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, template_id')
      .order('created_at', { ascending: false });
    
    console.log('[Dashboard] Workspaces query result - data:', data?.length || 0, 'items, error:', error?.message || 'none');
    
    if (error && isSupabaseNetworkError(error)) {
      console.error('[Dashboard] Network error fetching workspaces');
      return <NetworkError message="Unable to load workspaces. Please check your internet connection." />;
    }
    
    if (error) {
      console.error('[Dashboard] Error fetching workspaces:', error);
    } else {
      workspaces = data;
      console.log('[Dashboard] Workspaces loaded successfully:', workspaces?.length || 0);
    }
  } catch (error: any) {
    console.error('[Dashboard] Unexpected error fetching workspaces:', error);
    if (isSupabaseNetworkError(error)) {
      console.error('[Dashboard] Network error in catch block');
      return <NetworkError message="Unable to load workspaces. Please check your internet connection." />;
    }
  }

  // Fetch default workspace with error handling (single() returns error if not found)
  console.log('[Dashboard] Fetching default workspace...');
  let defaultWorkspace: any = null;
  try {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, template_id')
      .eq('name', 'default')
      .single();
    
    console.log('[Dashboard] Default workspace query result - data:', data ? 'found' : 'null', 'error:', error?.code || error?.message || 'none');
    
    if (error) {
      // Check if it's a "not found" error (PGRST116 or status 406)
      // This is expected if no default workspace exists yet
      if (error.code === 'PGRST116' || error.code === '42704' || error.status === 406) {
        // Not found is fine, we'll use first workspace instead
        console.log('[Dashboard] No default workspace found (expected), will use first available workspace');
      } else if (isSupabaseNetworkError(error)) {
        console.error('[Dashboard] Network error fetching default workspace');
        return <NetworkError message="Unable to load workspace. Please check your internet connection." />;
      } else {
        console.error('[Dashboard] Error fetching default workspace:', error);
      }
    } else {
      defaultWorkspace = data;
      console.log('[Dashboard] Default workspace loaded:', defaultWorkspace?.name || 'unnamed');
    }
  } catch (error: any) {
    console.error('[Dashboard] Unexpected error fetching default workspace:', error);
    if (isSupabaseNetworkError(error)) {
      console.error('[Dashboard] Network error in catch block for default workspace');
      return <NetworkError message="Unable to load workspace. Please check your internet connection." />;
    }
  }

  const selectedWorkspace = defaultWorkspace || (workspaces && workspaces[0]);
  console.log('[Dashboard] Selected workspace:', selectedWorkspace?.name || 'none', 'template_id:', selectedWorkspace?.template_id || 'none');

  // Fetch template name if template_id exists
  let templateName: string | null = null;
  if (selectedWorkspace?.template_id) {
    console.log('[Dashboard] Fetching template name for template_id:', selectedWorkspace.template_id);
    try {
      const { data: template, error: templateError } = await supabaseAdmin
        .from('templates')
        .select('name')
        .eq('id', selectedWorkspace.template_id)
        .single();
      
      console.log('[Dashboard] Template query result - name:', template?.name || 'null', 'error:', templateError?.message || 'none');
      
      if (templateError && isSupabaseNetworkError(templateError)) {
        console.error('[Dashboard] Network error fetching template');
        return <NetworkError message="Unable to load template. Please check your internet connection." />;
      }
      
      if (!templateError && template) {
        templateName = template.name || null;
        console.log('[Dashboard] Template name loaded:', templateName);
      }
    } catch (error: any) {
      console.error('[Dashboard] Unexpected error fetching template:', error);
      if (isSupabaseNetworkError(error)) {
        console.error('[Dashboard] Network error in catch block for template');
        return <NetworkError message="Unable to load template. Please check your internet connection." />;
      }
    }
  } else {
    console.log('[Dashboard] No template_id found in selected workspace, skipping template fetch');
  }

  // Get stats (mock for now, can be enhanced later)
  const stats = [
    { name: 'Projects Generated', value: '0', icon: '🎬' },
    { name: 'Workspaces', value: String(workspaces?.length || 0), icon: '📁' },
    { name: 'Templates', value: '3', icon: '📄' },
  ];

  console.log('[Dashboard] Preparing to render with stats:', stats);
  console.log('[Dashboard] Final state - workspaces:', workspaces?.length || 0, 'selectedWorkspace:', selectedWorkspace?.name || 'none', 'templateName:', templateName || 'none');
  console.log('[Dashboard] Starting render...');

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

