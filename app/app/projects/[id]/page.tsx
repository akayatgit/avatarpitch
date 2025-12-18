import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isSupabaseNetworkError } from '@/lib/networkError';
import NetworkError from '@/components/NetworkError';
import ProjectResultsClient from '@/components/ProjectResultsClient';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // In Next.js 15+, params is a Promise and needs to be awaited
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error && isSupabaseNetworkError(error)) {
      return <NetworkError message="Unable to load project. Please check your internet connection." />;
    }

    if (!project || error) {
      console.error('Project fetch error:', error);
      notFound();
    }

    // Transform database project to ProjectResults format
    const result = {
      scenes: (project.scenes as any[]) || [],
      renderingSpec: (project.rendering_spec as any) || {},
      videoUrl: project.video_url || '',
      templateName: project.template_name || 'Unknown Template',
      projectId: project.id,
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                <span>Content Type: {project.template_name || 'Unknown'}</span>
                <span>•</span>
                <span>Platform: {project.platform}</span>
                {project.created_at && (
                  <>
                    <span>•</span>
                    <span>
                      Created: {new Date(project.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Link
              href="/app"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all font-medium text-sm shadow-sm"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        <ProjectResultsClient result={result} />
      </div>
    );
  } catch (error: any) {
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    throw error;
  }
}

