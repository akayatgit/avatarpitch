'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import WorkflowPreview from './WorkflowPreview';
import { type AgentWorkflow } from '@/lib/agents';
import { deleteTemplate, updateTemplateCoverImage } from '@/app/app/actions';

interface Template {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  cover_image_url?: string | null;
  config?: any;
}

interface TemplateListProps {
  templates: Template[];
}

export default function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewWorkflow, setPreviewWorkflow] = useState<AgentWorkflow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (templates.length === 0) {
    return <p className="text-sm text-gray-400">No content types yet. Create one above.</p>;
  }

  const handlePreviewWorkflow = (template: Template) => {
    const workflow = template.config?.workflow?.agentWorkflow || null;
    setPreviewWorkflow(workflow);
    setPreviewTemplateId(template.id);
  };

  const handleDeleteClick = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(templateId);
  };

  const handleDeleteConfirm = async (templateId: string) => {
    setDeletingId(templateId);
    setDeleteConfirmId(null);

    const formData = new FormData();
    formData.append('id', templateId);

    const result = await deleteTemplate(formData);

    if (result.error) {
      alert(`Failed to delete content type: ${result.error}`);
      setDeletingId(null);
    } else {
      router.refresh();
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  const handleImageUpload = async (templateId: string, file: File) => {
    setUploadingId(templateId);

    try {
      // Upload image to Vercel
      const formData = new FormData();
      formData.append('images', file);

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      if (!imageUrl) {
        throw new Error('No image URL returned');
      }

      // Update content type with image URL
      const updateFormData = new FormData();
      updateFormData.append('id', templateId);
      updateFormData.append('coverImageUrl', imageUrl);

      const result = await updateTemplateCoverImage(updateFormData);

      if (result.error) {
        alert(`Failed to update cover image: ${result.error}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleImageClick = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRefs.current[templateId]?.click();
  };

  const handleFileChange = (templateId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }
      handleImageUpload(templateId, file);
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {templates.map((template: any) => (
        <div
          key={template.id}
          className="card cursor-pointer group hover:shadow-md transition-all duration-200 active:scale-[0.98] touch-manipulation p-0 overflow-hidden flex flex-col"
        >
          <div className="relative w-full overflow-hidden bg-gray-900 aspect-square rounded-t-lg">
            {template.cover_image_url ? (
              <>
                <img
                  src={template.cover_image_url}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                {/* Icon buttons overlay - top right */}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewWorkflow(template);
                    }}
                    className="p-1.5 bg-black/70 text-white rounded-lg hover:bg-black/90 transition-all duration-200 backdrop-blur-sm"
                    title="Preview workflow"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <Link
                    href={`/app/templates/${template.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 bg-[#D1FE17] text-black rounded-lg hover:bg-[#B8E014] transition-all duration-200"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  {deleteConfirmId === template.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConfirm(template.id);
                        }}
                        disabled={deletingId === template.id}
                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50"
                        title="Confirm delete"
                      >
                        {deletingId === template.id ? (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCancel();
                        }}
                        disabled={deletingId === template.id}
                        className="p-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 disabled:opacity-50"
                        title="Cancel"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(template.id, e)}
                      disabled={deletingId === template.id || deleteConfirmId !== null}
                      className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === template.id ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                {/* Replace image button - center on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <button
                    onClick={(e) => handleImageClick(template.id, e)}
                    disabled={uploadingId === template.id}
                    className="opacity-0 group-hover:opacity-100 text-white text-xs px-3 py-1.5 bg-black bg-opacity-60 rounded-lg hover:bg-opacity-80 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingId === template.id ? 'Uploading...' : 'Replace Image'}
                  </button>
                </div>
              </>
            ) : (
              <div
                onClick={(e) => handleImageClick(template.id, e)}
                className="w-full h-full bg-gray-900 border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-[#D1FE17] hover:bg-gray-800 transition-all duration-200"
              >
                {uploadingId === template.id ? (
                  <div className="text-gray-400 text-sm">Uploading...</div>
                ) : (
                  <>
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-xs text-gray-400 font-medium text-center px-2">Click to upload</div>
                  </>
                )}
              </div>
            )}
            <input
              ref={(el) => { fileInputRefs.current[template.id] = el; }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(template.id, e)}
              disabled={uploadingId === template.id}
            />
          </div>
          <div className="p-3 bg-black border-t border-gray-800 flex-shrink-0 rounded-b-lg">
            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-gray-400 mb-2 line-clamp-2">{template.description}</p>
            )}
          </div>
        </div>
      ))}

      {previewTemplateId && (
        <WorkflowPreview
          templateId={previewTemplateId}
          workflow={previewWorkflow}
          onClose={() => {
            setPreviewTemplateId(null);
            setPreviewWorkflow(null);
          }}
        />
      )}
    </div>
  );
}

