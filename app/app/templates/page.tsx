import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createTemplate } from '../actions';
import TemplatesPageClient from './TemplatesPageClient';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TemplatesPage() {
  const { data: templates, error } = await supabaseAdmin
    .from('content_types')
    .select('id, name, description, category, version, created_at, cover_image_url')
    .order('created_at', { ascending: false });

  if (error && isSupabaseNetworkError(error)) {
    return <NetworkError message="Unable to load content types. Please check your internet connection." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <TemplatesPageClient templates={templates || []} createTemplate={createTemplate} />
    </div>
  );
}

