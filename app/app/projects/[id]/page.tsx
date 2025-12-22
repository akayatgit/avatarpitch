import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isSupabaseNetworkError } from '@/lib/networkError';
import NetworkError from '@/components/NetworkError';
import ProjectResultsClient from '@/components/content-creation/ProjectResultsClient';

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
    // Try content_creation_requests first (new format)
    let { data: request, error: requestError } = await supabaseAdmin
      .from('content_creation_requests')
      .select(`
        id,
        content_type_id,
        inputs,
        generated_output,
        status,
        video_url,
        created_at,
        content_types:content_type_id (
          name
        )
      `)
      .eq('id', projectId)
      .single();

    let result: any = null;
    let projectName = 'Project';

    if (!requestError && request) {
      // Handle content_creation_requests format
      const contentType = Array.isArray(request.content_types) 
        ? request.content_types[0] 
        : request.content_types;
      
      let inputs: any = {};
      try {
        inputs = typeof request.inputs === 'string' 
          ? JSON.parse(request.inputs) 
          : request.inputs || {};
      } catch (e) {
        console.error('Error parsing inputs:', e);
      }
      
      let generatedOutput: any = {};
      try {
        generatedOutput = typeof request.generated_output === 'string'
          ? JSON.parse(request.generated_output)
          : request.generated_output || {};
      } catch (e) {
        console.error('Error parsing generated_output:', e);
      }

      const productName = inputs['PRODUCT NAME'] || 
                         inputs['product name'] || 
                         inputs.subject?.name || 
                         'Untitled Project';
      projectName = `${contentType?.name || 'Content'} - ${productName}`;

      result = {
        scenes: generatedOutput?.scenes || [],
        renderingSpec: {},
        videoUrl: request.video_url || '',
        templateName: contentType?.name || 'Unknown Template',
        projectId: request.id,
      };
    } else {
      // Fallback to projects table (legacy format)
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

      projectName = project.name || 'Project';
      result = {
        scenes: (project.scenes as any[]) || [],
        renderingSpec: (project.rendering_spec as any) || {},
        videoUrl: project.video_url || '',
        templateName: project.template_name || 'Unknown Template',
        projectId: project.id,
      };
    }

    if (!result) {
      notFound();
    }

    return (
      <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{projectName}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                <span>Content Type: {result.templateName || 'Unknown'}</span>
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

