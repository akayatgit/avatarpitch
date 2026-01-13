import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isSupabaseNetworkError } from '@/lib/networkError';
import NetworkError from '@/components/NetworkError';
import ProjectResultsClient from '@/components/content-creation/ProjectResultsClient';
import { getCurrentUser } from '@/lib/session';

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
    // Get current user
    const user = await getCurrentUser();
    
    // Fetch from content_creation_requests
    let query = supabaseAdmin
      .from('content_creation_requests')
      .select(`
        id,
        content_type_id,
        inputs,
        generated_output,
        status,
        video_url,
        created_at,
        user_id,
        content_types:content_type_id (
          name
        )
      `)
      .eq('id', projectId);

    // If user is logged in, ensure they can only access their own projects
    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      // Guest users cannot access projects
      notFound();
    }

    const { data: request, error: requestError } = await query.single();

    if (requestError && isSupabaseNetworkError(requestError)) {
      return <NetworkError message="Unable to load project. Please check your internet connection." />;
    }

    if (!request || requestError) {
      console.error('Project fetch error:', requestError);
      notFound();
    }

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
    const projectName = `${contentType?.name || 'Content'} - ${productName}`;

    const result = {
      scenes: generatedOutput?.scenes || [],
      videoUrl: request.video_url || '',
      templateName: contentType?.name || 'Unknown Template',
      projectId: request.id,
    };

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

