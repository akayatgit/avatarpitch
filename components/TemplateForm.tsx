'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContentTypeDefinition, ContentTypeDefinitionSchema } from '../lib/schemas';
import { z } from 'zod';

interface TemplateFormProps {
  createTemplate?: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  updateTemplate?: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  templateId?: string;
  initialData?: Partial<ContentTypeDefinition>;
  onSuccess?: () => void;
}

const defaultContentType: ContentTypeDefinition = {
  id: '',
  name: '',
  category: 'marketing',
  description: '',
  version: '1.0.0',
  outputContract: {
    format: 'storyboard_v1',
    requiredOutputs: {
      scenes: true,
      imagePromptPerScene: true,
      textOverlaySuggestions: true,
      thumbnailPrompt: true,
    },
    sceneSchema: {
      id: 'string',
      purpose: 'string',
      imagePrompt: 'string',
    },
    globalDefaults: {
      durationPerSceneSeconds: 3,
      allowedAspectRatios: ['9:16'],
      defaultAspectRatio: '9:16',
      visualStylePreset: 'ugc',
      defaultLanguage: 'en',
    },
  },
  sceneGenerationPolicy: {
    minScenes: 5,
    maxScenes: 8,
    rules: {
      mustStartStrong: true,
      mustEndWithClosure: true,
      avoidRepetition: true,
      platformAwareOrdering: true,
    },
  },
  inputsContract: {
    fields: [],
  },
  prompting: {
    systemPromptTemplate: '',
    agents: [],
    safetyRules: {},
  },
};

export default function TemplateForm({ 
  createTemplate, 
  updateTemplate, 
  templateId, 
  initialData,
  onSuccess 
}: TemplateFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const [formData, setFormData] = useState<ContentTypeDefinition>(
    initialData ? { ...defaultContentType, ...initialData } : defaultContentType
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>((initialData as any)?.coverImageUrl || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!templateId && !!updateTemplate;

  // Initialize JSON content
  useEffect(() => {
    if (initialData) {
      setJsonContent(JSON.stringify(initialData, null, 2));
      setFormData({ ...defaultContentType, ...initialData });
      setCoverImageUrl((initialData as any).coverImageUrl || null);
    } else {
      setJsonContent(JSON.stringify(defaultContentType, null, 2));
    }
  }, [initialData]);

  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    setJsonError(null);
    try {
      if (!value || value.trim() === '') {
        setJsonError('JSON content cannot be empty');
        return;
      }
      const parsed = JSON.parse(value);
      if (!ContentTypeDefinitionSchema) {
        setJsonError('Schema not available');
        return;
      }
      const validated = ContentTypeDefinitionSchema.parse(parsed);
      setFormData(validated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setJsonError(`Validation error: ${err.errors.map(e => e.message).join(', ')}`);
      } else if (err instanceof SyntaxError) {
        setJsonError('Invalid JSON syntax');
      } else {
        setJsonError(`Invalid JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    let dataToSubmit: ContentTypeDefinition;

    if (jsonMode) {
      try {
        if (!jsonContent || jsonContent.trim() === '') {
          setError('JSON content cannot be empty');
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(jsonContent);
        if (!ContentTypeDefinitionSchema) {
          setError('Schema not available');
          setLoading(false);
          return;
        }
        dataToSubmit = ContentTypeDefinitionSchema.parse(parsed);
      } catch (err) {
        if (err instanceof z.ZodError) {
          setError(`Validation error: ${err.errors.map(e => e.message).join(', ')}`);
        } else if (err instanceof SyntaxError) {
          setError('Invalid JSON syntax');
        } else {
          setError(`Invalid JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        setLoading(false);
        return;
      }
    } else {
      dataToSubmit = formData;
    }

    const formDataObj = new FormData();
    formDataObj.set('name', dataToSubmit.name);
    formDataObj.set('category', dataToSubmit.category);
    if (dataToSubmit.description) {
      formDataObj.set('description', dataToSubmit.description);
    }
    formDataObj.set('version', dataToSubmit.version);
    formDataObj.set('outputContract', JSON.stringify(dataToSubmit.outputContract));
    formDataObj.set('sceneGenerationPolicy', JSON.stringify(dataToSubmit.sceneGenerationPolicy));
    formDataObj.set('inputsContract', JSON.stringify(dataToSubmit.inputsContract));
    formDataObj.set('prompting', JSON.stringify(dataToSubmit.prompting));
    
    if (coverImageUrl) {
      formDataObj.set('coverImageUrl', coverImageUrl);
    }
    
    if (isEditMode && templateId) {
      formDataObj.set('templateId', templateId);
    }
    
    const result = isEditMode && updateTemplate
      ? await updateTemplate(formDataObj)
      : createTemplate
      ? await createTemplate(formDataObj)
      : { error: 'No create or update function provided' };

    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setSuccess(true);
      if (formRef.current) {
        formRef.current.reset();
      }
      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) {
          onSuccess();
        } else if (isEditMode) {
          setTimeout(() => {
            router.push('/app/templates');
          }, 500);
        }
      }, 2000);
    }

    setLoading(false);
  };

  const updateField = (path: string[], value: any) => {
    const newData = { ...formData };
    let current: any = newData;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setFormData(newData);
    setJsonContent(JSON.stringify(newData, null, 2));
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        setUploadingImage(false);
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        setUploadingImage(false);
        return;
      }

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

      setCoverImageUrl(imageUrl);
      setError(null);
    } catch (error) {
      setError(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-5">
        {/* Toggle between form and JSON mode */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setJsonMode(!jsonMode);
              if (!jsonMode) {
                setJsonContent(JSON.stringify(formData, null, 2));
              }
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {jsonMode ? 'Switch to Form View' : 'Switch to JSON View'}
          </button>
        </div>

        {jsonMode ? (
          /* JSON Mode */
          <div>
            <label htmlFor="jsonContent" className="block text-sm font-medium text-gray-700 mb-2">
              Content Type Definition (JSON)
            </label>
            <textarea
              id="jsonContent"
              value={jsonContent}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={30}
              className={`input-field font-mono text-sm ${jsonError ? 'border-red-500' : ''}`}
              placeholder="Enter JSON content type definition..."
            />
            {jsonError && (
              <div className="mt-2 text-sm text-red-600">{jsonError}</div>
            )}
          </div>
        ) : (
          /* Form Mode */
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Content Type Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => updateField(['name'], e.target.value)}
                className="input-field min-h-[44px] touch-manipulation"
                placeholder="e.g., UGC Product Demo"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                id="category"
                required
                value={formData.category}
                onChange={(e) => updateField(['category'], e.target.value as ContentTypeDefinition['category'])}
                className="input-field min-h-[44px] touch-manipulation"
              >
                <option value="marketing">Marketing</option>
                <option value="entertainment">Entertainment</option>
                <option value="education">Education</option>
                <option value="review">Review</option>
                <option value="story">Story</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                id="description"
                rows={4}
                value={formData.description || ''}
                onChange={(e) => updateField(['description'], e.target.value)}
                className="input-field min-h-[100px] touch-manipulation resize-y"
                placeholder="Brief description of this content type"
              />
            </div>

            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700 mb-2">
                Version *
              </label>
              <input
                type="text"
                id="version"
                required
                value={formData.version}
                onChange={(e) => updateField(['version'], e.target.value)}
                className="input-field min-h-[44px] touch-manipulation"
                placeholder="e.g., 1.0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Image (optional)
              </label>
              {coverImageUrl ? (
                <div className="relative">
                  <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={coverImageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleImageClick}
                      disabled={uploadingImage}
                      className="text-sm px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingImage ? 'Uploading...' : 'Replace Image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl(null)}
                      disabled={uploadingImage}
                      className="text-sm px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 active:bg-red-300 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleImageClick}
                  className="w-full h-48 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-all duration-200"
                >
                  {uploadingImage ? (
                    <div className="text-gray-500 text-sm">Uploading...</div>
                  ) : (
                    <>
                      <div className="text-4xl mb-2">📷</div>
                      <div className="text-sm text-gray-600 font-medium">Click to upload cover image</div>
                      <div className="text-xs text-gray-500 mt-1">Max 10MB</div>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadingImage}
              />
            </div>

            <div className="border-t pt-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Output Contract</h3>
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Aspect Ratio
                  </label>
                  <select
                    value={formData.outputContract.globalDefaults.defaultAspectRatio}
                    onChange={(e) => updateField(['outputContract', 'globalDefaults', 'defaultAspectRatio'], e.target.value)}
                    className="input-field min-h-[44px]"
                  >
                    <option value="9:16">9:16</option>
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration Per Scene (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.outputContract.globalDefaults.durationPerSceneSeconds}
                    onChange={(e) => updateField(['outputContract', 'globalDefaults', 'durationPerSceneSeconds'], parseInt(e.target.value))}
                    className="input-field min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visual Style Preset
                  </label>
                  <input
                    type="text"
                    value={formData.outputContract.globalDefaults.visualStylePreset}
                    onChange={(e) => updateField(['outputContract', 'globalDefaults', 'visualStylePreset'], e.target.value)}
                    className="input-field min-h-[44px]"
                    placeholder="e.g., ugc, cinematic, meme"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scene Generation Policy</h3>
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Scenes
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.sceneGenerationPolicy.minScenes}
                      onChange={(e) => updateField(['sceneGenerationPolicy', 'minScenes'], parseInt(e.target.value))}
                      className="input-field min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Scenes
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.sceneGenerationPolicy.maxScenes}
                      onChange={(e) => updateField(['sceneGenerationPolicy', 'maxScenes'], parseInt(e.target.value))}
                      className="input-field min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Input Fields</h3>
                <button
                  type="button"
                  onClick={() => {
                    const newField = {
                      key: '',
                      label: '',
                      type: 'string' as const,
                      required: false,
                    };
                    updateField(['inputsContract', 'fields'], [...formData.inputsContract.fields, newField]);
                  }}
                  className="btn-secondary text-sm px-4 py-2 min-h-[36px]"
                >
                  + Add Field
                </button>
              </div>
              <div className="space-y-4">
                {formData.inputsContract.fields.length === 0 ? (
                  <div className="bg-gray-50 p-8 rounded-lg border-2 border-dashed border-gray-300 text-center">
                    <p className="text-sm text-gray-500 mb-2">No input fields defined yet.</p>
                    <p className="text-xs text-gray-400">Click "Add Field" above to create your first input field.</p>
                  </div>
                ) : (
                  formData.inputsContract.fields.map((field, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Field {index + 1}
                          {field.label && `: ${field.label}`}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = [...formData.inputsContract.fields];
                            newFields.splice(index, 1);
                            updateField(['inputsContract', 'fields'], newFields);
                          }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Key *
                          </label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => {
                              const newFields = [...formData.inputsContract.fields];
                              newFields[index] = { ...newFields[index], key: e.target.value };
                              updateField(['inputsContract', 'fields'], newFields);
                            }}
                            className="input-field min-h-[44px] text-sm"
                            placeholder="e.g., subject.name"
                          />
                          <p className="text-xs text-gray-500 mt-1">Use dot notation for nested fields</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Label *
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => {
                              const newFields = [...formData.inputsContract.fields];
                              newFields[index] = { ...newFields[index], label: e.target.value };
                              updateField(['inputsContract', 'fields'], newFields);
                            }}
                            className="input-field min-h-[44px] text-sm"
                            placeholder="e.g., Subject Name"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type *
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const newFields = [...formData.inputsContract.fields];
                              const newField = { ...newFields[index], type: e.target.value as any };
                              // Clear options if not enum/list
                              if (e.target.value !== 'enum' && e.target.value !== 'list') {
                                delete newField.options;
                              }
                              // Clear maxItems if not list
                              if (e.target.value !== 'list') {
                                delete newField.maxItems;
                              }
                              // Clear maxLength if not string
                              if (e.target.value !== 'string') {
                                delete newField.maxLength;
                              }
                              newFields[index] = newField;
                              updateField(['inputsContract', 'fields'], newFields);
                            }}
                            className="input-field min-h-[44px] text-sm"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="enum">Enum (Dropdown)</option>
                            <option value="list">List (Multiple Values)</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center h-[44px] w-full">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => {
                                const newFields = [...formData.inputsContract.fields];
                                newFields[index] = { ...newFields[index], required: e.target.checked };
                                updateField(['inputsContract', 'fields'], newFields);
                              }}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Required field</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Length
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={field.maxLength || ''}
                            onChange={(e) => {
                              const newFields = [...formData.inputsContract.fields];
                              newFields[index] = { 
                                ...newFields[index], 
                                maxLength: e.target.value ? parseInt(e.target.value) : undefined 
                              };
                              updateField(['inputsContract', 'fields'], newFields);
                            }}
                            className="input-field min-h-[44px] text-sm"
                            placeholder="Optional"
                            disabled={field.type !== 'string'}
                          />
                        </div>
                      </div>
                      {field.type === 'enum' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Options (comma-separated) *
                          </label>
                          <input
                            type="text"
                            value={field.options?.join(', ') || ''}
                            onChange={(e) => {
                              const newFields = [...formData.inputsContract.fields];
                              newFields[index] = { 
                                ...newFields[index], 
                                options: e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                              };
                              updateField(['inputsContract', 'fields'], newFields);
                            }}
                            className="input-field min-h-[44px] text-sm"
                            placeholder="e.g., option1, option2, option3"
                          />
                          <p className="text-xs text-gray-500 mt-1">Separate options with commas</p>
                        </div>
                      )}
                      {field.type === 'list' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Options (comma-separated, optional)
                            </label>
                            <input
                              type="text"
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => {
                                const newFields = [...formData.inputsContract.fields];
                                newFields[index] = { 
                                  ...newFields[index], 
                                  options: e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                                };
                                updateField(['inputsContract', 'fields'], newFields);
                              }}
                              className="input-field min-h-[44px] text-sm"
                              placeholder="e.g., option1, option2"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave empty for free text list</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Max Items
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={field.maxItems || ''}
                              onChange={(e) => {
                                const newFields = [...formData.inputsContract.fields];
                                newFields[index] = { 
                                  ...newFields[index], 
                                  maxItems: e.target.value ? parseInt(e.target.value) : undefined 
                                };
                                updateField(['inputsContract', 'fields'], newFields);
                              }}
                              className="input-field min-h-[44px] text-sm"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Help Text (optional)
                        </label>
                        <input
                          type="text"
                          value={field.helpText || ''}
                          onChange={(e) => {
                            const newFields = [...formData.inputsContract.fields];
                            newFields[index] = { 
                              ...newFields[index], 
                              helpText: e.target.value || undefined 
                            };
                            updateField(['inputsContract', 'fields'], newFields);
                          }}
                          className="input-field min-h-[44px] text-sm"
                          placeholder="Helpful description for users"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t pt-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Prompt Template</h3>
              <textarea
                rows={6}
                value={formData.prompting.systemPromptTemplate}
                onChange={(e) => updateField(['prompting', 'systemPromptTemplate'], e.target.value)}
                className="input-field min-h-[150px] resize-y"
                placeholder="Enter system prompt template..."
              />
            </div>
          </>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-primary-600 bg-primary-50 p-4 rounded-xl border border-primary-200">
            Content Type {isEditMode ? 'updated' : 'created'} successfully!
          </div>
        )}
        <button
          type="submit"
          disabled={loading || (jsonMode && !!jsonError)}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Content Type' : 'Create Content Type')}
        </button>
      </div>
    </form>
  );
}
