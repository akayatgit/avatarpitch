import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createTemplate } from '../actions';
import TemplateList from '@/components/TemplateList';
import CollapsibleTemplateForm from '@/components/CollapsibleTemplateForm';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TemplatesPage() {
  const { data: templates, error } = await supabaseAdmin
    .from('templates')
    .select('id, name, description, created_at, config')
    .order('created_at', { ascending: false });

  if (error && isSupabaseNetworkError(error)) {
    return <NetworkError message="Unable to load templates. Please check your internet connection." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Templates</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Select a template to generate high-quality video projects with AI.
        </p>
      </div>

      <CollapsibleTemplateForm createTemplate={createTemplate} />

      <div className="mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">All Templates</h2>
        <TemplateList templates={templates || []} />
      </div>
    </div>
  );
}

