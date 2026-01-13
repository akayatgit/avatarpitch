import { supabaseAdmin } from '@/lib/supabaseAdmin';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';
import { generateProject } from '../actions';
import CreateProjectPageClient from '@/components/CreateProjectPageClient';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CreateProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  try {
    const resolvedSearchParams = await searchParams;
    const preselectedContentTypeId = resolvedSearchParams?.contentTypeId as string | undefined;

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('content_types')
      .select('id, name')
      .order('name', { ascending: true });

    if (templatesError && isSupabaseNetworkError(templatesError)) {
      return <NetworkError message="Unable to load content types. Please check your internet connection." />;
    }

    return (
      <CreateProjectPageClient
        templates={templates || []}
        generateProject={generateProject}
        preselectedContentTypeId={preselectedContentTypeId}
      />
    );
  } catch (error: any) {
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      return <NetworkError message={error.message.replace('NETWORK_ERROR: ', '')} />;
    }
    throw error;
  }
}

