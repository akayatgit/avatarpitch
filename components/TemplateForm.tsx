'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TemplateConfigForm from './TemplateConfigForm';

interface TemplateFormProps {
  createTemplate?: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  updateTemplate?: (templateId: string, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  templateId?: string;
  initialName?: string;
  initialDescription?: string;
  initialConfig?: any;
  onSuccess?: () => void;
}

const defaultConfig = {
  version: 1,
  output: {
    sceneCount: 5,
    minSceneSeconds: 3,
    maxSceneSeconds: 7,
    aspectRatio: "9:16",
    style: "UGC"
  },
  workflow: {
    systemPrompt: "You are a video script generator...",
    sceneBlueprint: [
      { type: "hook", goal: "Grab attention" },
      { type: "problem", goal: "Identify pain point" },
      { type: "solution", goal: "Show product solution" },
      { type: "proof", goal: "Demonstrate features" },
      { type: "cta", goal: "Encourage action" }
    ],
    constraints: [
      "No medical/financial promises",
      "No guaranteed results",
      "No competitor mentions"
    ]
  }
};

export default function TemplateForm({ 
  createTemplate, 
  updateTemplate, 
  templateId, 
  initialName = '', 
  initialDescription = '', 
  initialConfig,
  onSuccess 
}: TemplateFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [config, setConfig] = useState(initialConfig || defaultConfig);
  const [resetKey, setResetKey] = useState(0);
  const isEditMode = !!templateId && !!updateTemplate;

  // Update form fields when initial values change (for edit mode)
  useEffect(() => {
    if (isEditMode && formRef.current) {
      const nameInput = formRef.current.querySelector('[name="name"]') as HTMLInputElement;
      const descInput = formRef.current.querySelector('[name="description"]') as HTMLInputElement;
      if (nameInput && initialName) nameInput.value = initialName;
      if (descInput && initialDescription !== undefined) descInput.value = initialDescription;
    }
  }, [isEditMode, initialName, initialDescription]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    // Convert config object to JSON string
    formData.set('config', JSON.stringify(config));
    
    // Add templateId to formData if in edit mode
    if (isEditMode && templateId) {
      formData.set('templateId', templateId);
    }
    
    const result = isEditMode && updateTemplate
      ? await updateTemplate(formData)
      : createTemplate
      ? await createTemplate(formData)
      : { error: 'No create or update function provided' };

    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setSuccess(true);
      if (formRef.current) {
        formRef.current.reset();
      }
      setConfig({ ...defaultConfig });
      setResetKey(prev => prev + 1);
      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) {
          onSuccess();
        } else if (isEditMode) {
          // If no onSuccess callback, redirect after a short delay
          setTimeout(() => {
            router.push('/app/templates');
          }, 500);
        }
      }, 2000);
    }

    setLoading(false);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Template Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            defaultValue={initialName}
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3.5 min-h-[44px] touch-manipulation"
            placeholder="e.g., UGC Product Demo"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            id="description"
            name="description"
            defaultValue={initialDescription}
            className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3.5 min-h-[44px] touch-manipulation"
            placeholder="Brief description of this template"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Config
          </label>
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <TemplateConfigForm key={resetKey} value={config} onChange={setConfig} />
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-600 bg-green-50 p-4 rounded-xl border border-green-200">
            Template {isEditMode ? 'updated' : 'created'} successfully!
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-purple-600 active:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all touch-manipulation min-h-[44px]"
        >
          {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Template' : 'Create Template')}
        </button>
      </div>
    </form>
  );
}

