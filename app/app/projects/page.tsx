import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { bootstrap } from '../actions';
import Link from 'next/link';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import ProjectList from '@/components/ProjectList';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectsPage() {
  console.log('[ProjectsPage] Function started');
  
  try {
    console.log('[ProjectsPage] Calling bootstrap()...');
    await bootstrap();
    console.log('[ProjectsPage] bootstrap() completed successfully');
  } catch (error: any) {
    console.error('[ProjectsPage] bootstrap() error:', error);
    // If it's a network error, show the network error component
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      console.log('[ProjectsPage] Returning NetworkError component');
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    // For other errors, log but continue - we'll show projects if they exist
    console.warn('[ProjectsPage] Bootstrap warning, continuing anyway:', error.message);
  }

  // Fetch projects list
  console.log('[ProjectsPage] Fetching projects...');
  let projects: any[] = [];
  try {
    const { data: projectsData, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, name, template_name, product_name, platform, created_at, scenes')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (projectsError && isSupabaseNetworkError(projectsError)) {
      console.error('[ProjectsPage] Network error fetching projects');
      return <NetworkError message="Unable to load projects. Please check your internet connection." />;
    }
    
    if (!projectsError && projectsData) {
      projects = projectsData;
    }
  } catch (error: any) {
    console.error('[ProjectsPage] Unexpected error fetching projects:', error);
    if (isSupabaseNetworkError(error)) {
      return <NetworkError message="Unable to load projects. Please check your internet connection." />;
    }
  }

  console.log('[ProjectsPage] Starting render...');

  const hasProjects = projects.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8 min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">My Projects</h1>
          <p className="text-sm text-gray-400">View and manage your created content</p>
        </div>
        {hasProjects && (
          <Link
            href="/app/create"
            className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>+</span>
            <span>Create new project</span>
          </Link>
        )}
      </div>

      {/* Projects List or Welcome Screen */}
      <div className={hasProjects ? 'mb-6 lg:mb-8' : ''}>
        <ProjectList projects={projects} />
      </div>
    </div>
  );
}

