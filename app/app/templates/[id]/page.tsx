import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notFound } from 'next/navigation';
import TemplateForm from '@/components/TemplateForm';
import { updateTemplate } from '../../actions';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // In Next.js 15+, params is a Promise and needs to be awaited
  const resolvedParams = await params;
  const templateId = resolvedParams.id;
  
  const { data: template, error } = await supabaseAdmin
    .from('templates')
    .select('id, name, description, config')
    .eq('id', templateId)
    .single();

  if (!template || error) {
    console.error('Template fetch error:', error);
    notFound();
  }

  // Ensure config is parsed if it's a string (Supabase JSONB should be auto-parsed, but handle both cases)
  let config = template.config;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      console.error('Failed to parse template config:', e);
    }
  }

  async function handleUpdate(formData: FormData) {
    'use server';
    // Add templateId to formData
    formData.append('templateId', templateId);
    return await updateTemplate(formData);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Edit Content Type: {template.name}</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Update content type configuration and settings
        </p>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <TemplateForm
          updateTemplate={handleUpdate}
          templateId={templateId}
          initialName={template.name}
          initialDescription={template.description || ''}
          initialConfig={config}
        />
      </div>
    </div>
  );
}

