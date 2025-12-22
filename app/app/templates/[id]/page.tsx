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
  
  const { data: contentType, error } = await supabaseAdmin
    .from('content_types')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!contentType || error) {
    console.error('Content type fetch error:', error);
    notFound();
  }

  // Convert database structure to ContentTypeDefinition format
  const initialData: any = {
    id: contentType.id,
    name: contentType.name,
    category: contentType.category,
    description: contentType.description,
    version: contentType.version,
    outputContract: contentType.output_contract,
    sceneGenerationPolicy: contentType.scene_generation_policy,
    inputsContract: contentType.inputs_contract,
    prompting: contentType.prompting,
    coverImageUrl: contentType.cover_image_url || null,
  };

  async function handleUpdate(formData: FormData) {
    'use server';
    // Add templateId to formData
    formData.append('templateId', templateId);
    return await updateTemplate(formData);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Edit Content Type: {contentType.name}</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Update content type configuration and settings
        </p>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <TemplateForm
          updateTemplate={handleUpdate}
          templateId={templateId}
          initialData={initialData}
        />
      </div>
    </div>
  );
}

