import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { bootstrap } from '../actions';
import Link from 'next/link';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import ProjectList from '@/components/ProjectList';
import { getCurrentUser } from '@/lib/session';

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

  // Get current user
  const user = await getCurrentUser();
  const userId = user?.id;

  // Fetch projects list from content_creation_requests
  console.log('[ProjectsPage] Fetching projects...');
  let projects: any[] = [];
  try {
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
        updated_at,
        content_types:content_type_id (
          name
        )
      `);

    // Filter by user_id if user is logged in, otherwise show empty
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // If not logged in, return empty array (guest users see welcome screen)
      // Use a condition that will never match to return empty results
      query = query.is('user_id', null).eq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { data: requestsData, error: requestsError } = await query
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (requestsError && isSupabaseNetworkError(requestsError)) {
      console.error('[ProjectsPage] Network error fetching projects');
      return <NetworkError message="Unable to load projects. Please check your internet connection." />;
    }
    
    if (!requestsError && requestsData) {
      // Transform content_creation_requests to match the expected project format
      projects = requestsData.map((request: any) => {
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
        
        // Extract product name from inputs (handle both flat and nested structures)
        const productName = inputs['PRODUCT NAME'] || 
                           inputs['product name'] || 
                           inputs.subject?.name || 
                           'Untitled Project';
        
        // Get scenes from generated_output, or empty array if not yet generated
        const scenes = generatedOutput?.scenes || [];
        const sceneCount = scenes.length;
        
        // If status is pending and no scenes yet, show "Generating..." instead of 0
        const isGenerating = (request.status === 'pending' || request.status === 'processing') && sceneCount === 0;
        
        return {
          id: request.id,
          name: `${contentType?.name || 'Content'} - ${productName}`,
          template_name: contentType?.name || 'Unknown',
          product_name: productName,
          platform: inputs.platform || 'unknown',
          created_at: request.created_at,
          scenes: scenes,
          status: request.status,
          video_url: request.video_url,
          isGenerating: isGenerating, // Flag to indicate generation in progress
        };
      });
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
      {hasProjects && (
        <div className="flex justify-end mb-6 lg:mb-8">
          <Link
            href="/app/create"
            className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>+</span>
            <span>Create new project</span>
          </Link>
        </div>
      )}

      {/* Projects List or Welcome Screen */}
      <div className={hasProjects ? 'mb-6 lg:mb-8' : ''}>
        <ProjectList projects={projects} />
      </div>
    </div>
  );
}

