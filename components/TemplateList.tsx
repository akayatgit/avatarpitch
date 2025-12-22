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
    return <p className="text-sm text-gray-500">No content types yet. Create one above.</p>;
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
          className="card cursor-pointer group hover:shadow-md transition-all duration-200 active:scale-[0.98] touch-manipulation p-0 overflow-hidden flex flex-col aspect-[9/16]"
        >
          <div className="relative flex-1 w-full overflow-hidden bg-gray-100">
            {template.cover_image_url ? (
              <>
                <img
                  src={template.cover_image_url}
                  alt={template.name}
                  className="w-full h-full object-cover aspect-[9/16]"
                />
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
                className="w-full h-full aspect-[9/16] bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-all duration-200"
              >
                {uploadingId === template.id ? (
                  <div className="text-gray-500 text-sm">Uploading...</div>
                ) : (
                  <>
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-xs text-gray-600 font-medium text-center px-2">Click to upload</div>
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
          <div className="p-3 bg-white border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{template.description}</p>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex gap-1 flex-wrap">
                <Link
                  href={`/app/templates/${template.id}`}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200 font-medium flex-1 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  Edit
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewWorkflow(template);
                  }}
                  className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 active:bg-primary-300 transition-colors duration-200 font-medium flex-1"
                >
                  Preview
                </button>
              </div>
              {deleteConfirmId === template.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConfirm(template.id);
                    }}
                    disabled={deletingId === template.id}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                  >
                    {deletingId === template.id ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCancel();
                    }}
                    disabled={deletingId === template.id}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => handleDeleteClick(template.id, e)}
                  disabled={deletingId === template.id || deleteConfirmId !== null}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 active:bg-red-300 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  Delete
                </button>
              )}
            </div>
            <span className="text-xs text-gray-500 mt-2 block">
              {new Date(template.created_at).toLocaleDateString()}
            </span>
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

