'use client';

import { useState, useEffect, useRef } from 'react';
import ProjectResults from '../ProjectResults';
import AgentProgressFlow from '../AgentProgressFlow';
import DynamicFormFields from '../DynamicFormFields';
import { ContentTypeDefinition, ContentCreationRequest } from '@/lib/schemas';

interface Template {
  id: string;
  name: string;
}

interface CreateProjectFormProps {
  templates: Template[];
  generateProject: (formData: FormData) => Promise<any>;
  preselectedContentTypeId?: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  order: number;
}

export default function CreateProjectForm({ templates, generateProject, preselectedContentTypeId }: CreateProjectFormProps) {
  console.log('[CreateProjectForm] Component rendered:', {
    templatesCount: templates.length,
    preselectedContentTypeId
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(preselectedContentTypeId || '');
  const [contentType, setContentType] = useState<ContentTypeDefinition | null>(null);
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set());
  const [agentResponses, setAgentResponses] = useState<Map<string, any>>(new Map());
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [totalScenes, setTotalScenes] = useState<number>(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const simulationRef = useRef<{ stop: boolean; actualSceneCount: number | null }>({ stop: false, actualSceneCount: null });
  
  // Image generation settings
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('flux-schnell');
  const [numImages, setNumImages] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [size, setSize] = useState<string>('4K');
  const [generationMode, setGenerationMode] = useState<'fast' | 'sequential'>('fast');
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Fetch content type when template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setContentType(null);
      setFormInputs({});
      setAgents([]);
      return;
    }

    const fetchContentType = async () => {
      try {
        console.log('[CreateProjectForm] Fetching content type:', selectedTemplateId);
        // Add cache-busting query parameter to ensure fresh data
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch(`/api/content-types/${selectedTemplateId}${cacheBuster}`, {
          cache: 'no-store', // Prevent browser caching
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[CreateProjectForm] Content type loaded:', {
            name: data.contentType?.name,
            fieldsCount: data.contentType?.inputsContract?.fields?.length,
            fields: data.contentType?.inputsContract?.fields?.map((f: any) => f.key)
          });
          
          setContentType(data.contentType);
          
          // Extract agents from agentWorkflow (preferred) or agents array
          let agentsList: Agent[] = [];
          
          if (data.contentType?.prompting?.agentWorkflow?.agents) {
            // Use agentWorkflow if available (full agent definitions)
            agentsList = data.contentType.prompting.agentWorkflow.agents
              .map((agent: any, index: number) => ({
                id: agent.id || `agent-${index}`,
                name: agent.name || agent.role || `Agent ${index + 1}`,
                role: agent.role || agent.name || `agent-${index}`,
                order: agent.order ?? index,
              }))
              .sort((a: Agent, b: Agent) => a.order - b.order);
          } else if (data.contentType?.prompting?.agents) {
            // Fallback to agents array (could be strings or objects)
            const agents = data.contentType.prompting.agents;
            if (Array.isArray(agents) && agents.length > 0) {
              if (typeof agents[0] === 'string') {
                // Array of agent names
                agentsList = agents.map((agentName: string, index: number) => ({
                  id: `agent-${index}`,
                  name: agentName,
                  role: agentName.toLowerCase().replace(/\s+/g, '_'),
                  order: index,
                }));
              } else if (typeof agents[0] === 'object' && agents[0].id) {
                // Array of agent objects
                agentsList = agents.map((agent: any, index: number) => ({
                  id: agent.id || `agent-${index}`,
                  name: agent.name || agent.role || `Agent ${index + 1}`,
                  role: agent.role || agent.name || `agent-${index}`,
                  order: agent.order ?? index,
                })).sort((a: Agent, b: Agent) => a.order - b.order);
              }
            }
          }
          
          setAgents(agentsList);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[CreateProjectForm] API error:', response.status, errorData);
        }
      } catch (err) {
        console.error('[CreateProjectForm] Error fetching content type:', err);
        setError('Failed to load content type. Please try again.');
      }
    };

    fetchContentType();
  }, [selectedTemplateId]);

  const simulateProgressForScene = async (agents: Agent[], sceneNumber: number) => {
    setCompletedAgents(new Set());
    setAgentResponses(new Map());
    setCurrentAgentId(null);
    setCurrentScene(sceneNumber);

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      setCurrentAgentId(agent.id);
      
      // Increased delay to better match actual LLM API call times (5-15 seconds per agent)
      // This is still a simulation, but closer to reality
      const delay = 5000 + Math.random() * 10000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      setCompletedAgents(prev => new Set([...prev, agent.id]));
      setAgentResponses(prev => {
        const newMap = new Map(prev);
        newMap.set(agent.id, {
          status: 'completed',
          message: `${agent.name} has completed processing for scene ${sceneNumber}`,
          timestamp: new Date().toISOString(),
        });
        return newMap;
      });
    }
    
    setCurrentAgentId(null);
  };

  const simulateAllScenes = async (agents: Agent[], estimatedSceneCount: number, generationPromise: Promise<any>) => {
    setShowProgressDialog(true);
    setIsFinalizing(false);
    simulationRef.current.stop = false;
    simulationRef.current.actualSceneCount = null;
    
    // Start with estimated count, but check for actual count during simulation
    let currentMaxScenes = estimatedSceneCount;
    
    // Run simulation and wait for actual generation in parallel
    const simulationPromise = (async () => {
      for (let sceneNum = 1; sceneNum <= currentMaxScenes; sceneNum++) {
        // Check if we have actual scene count and should stop early
        if (simulationRef.current.actualSceneCount !== null) {
          currentMaxScenes = simulationRef.current.actualSceneCount;
          if (sceneNum > currentMaxScenes) {
            break;
          }
        }
        
        // Check if we should stop (generation completed)
        if (simulationRef.current.stop) {
          break;
        }
        
        await simulateProgressForScene(agents, sceneNum);
        
        // Check totalScenes state - if it changed to a lower number, adjust
        if (totalScenes > 0 && totalScenes < estimatedSceneCount && sceneNum >= totalScenes) {
          currentMaxScenes = totalScenes;
          break;
        }
        
        if (sceneNum < currentMaxScenes) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If simulation finishes before generation, show "Crafting prompts..." message
      // This indicates that prompts are still being crafted on the backend
      if (!simulationRef.current.stop) {
        setIsFinalizing(true);
        setCurrentScene(0);
      }
    })();

    // Wait for generation to complete, then stop simulation
    try {
      await generationPromise;
      // Generation completed - stop simulation
      simulationRef.current.stop = true;
    } catch (error) {
      // Generation failed - stop simulation
      simulationRef.current.stop = true;
    }
    
    // Wait for simulation to finish if it's still running
    try {
      await simulationPromise;
    } catch (error) {
      // Simulation error - continue anyway
    }
    
    // Final state update
    setIsFinalizing(false);
    setCurrentScene(0);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentScene(0);
    setTotalScenes(0);
    setIsFinalizing(false);

    if (!selectedTemplateId || !contentType) {
      setError('Please select a content type first');
      setLoading(false);
      return;
    }

    // Build ContentCreationRequest structure
    const contentCreationRequest: Partial<ContentCreationRequest> = {
      contentTypeId: selectedTemplateId,
      inputs: formInputs as any, // Will be validated on the server
    };

    const formData = new FormData();
    formData.set('contentTypeId', selectedTemplateId);
    formData.set('inputs', JSON.stringify(formInputs));

    // Use minScenes as a better estimate (closer to actual count than maxScenes)
    // The actual count will be updated when we get the response
    const estimatedSceneCount = contentType.sceneGenerationPolicy?.minScenes || 
                                Math.floor((contentType.sceneGenerationPolicy?.minScenes || 3 + 
                                           contentType.sceneGenerationPolicy?.maxScenes || 8) / 2) || 5;
    setTotalScenes(estimatedSceneCount);

    // Start the generation promise first so simulation can track it
    const generationPromise = generateProject(formData);

    // Start progress simulation only if we have agents configured
    // The simulation will now wait for actual generation to complete
    if (agents.length > 0) {
      // Pass the generation promise to the simulation so it can track actual progress
      simulateAllScenes(agents, estimatedSceneCount, generationPromise).catch(() => {});
    } else {
      // If no agents, just show a simple loading state
      setShowProgressDialog(true);
      setIsFinalizing(false);
    }

    try {
      const response = await generationPromise;
      
      if (response.error) {
        setError(response.error);
        setCurrentAgentId(null);
        setShowProgressDialog(false);
      } else if (response.success && response.data) {
        const projectId = response.data.projectId;
        
        // If status is 'pending' or 'processing', start background generation
        if ((response.data.status === 'pending' || response.data.status === 'processing') && projectId) {
          // Upload reference images first if provided
          let referenceImageUrls: string[] = [];
          if (referenceImages.length > 0) {
            try {
              referenceImageUrls = await Promise.all(
                referenceImages.map(file => uploadImageToServer(file))
              );
            } catch (error) {
              console.error('Error uploading reference images:', error);
            }
          }
          
          // Start background generation (prompts + images)
          // Flux-Schnell doesn't require reference images, so always send settings if Flux-Schnell is selected
          const isFluxSchnell = selectedModel === 'flux-schnell';
          const shouldSendImageSettings = isFluxSchnell || referenceImageUrls.length > 0;
          
          try {
            await fetch('/api/generate-project', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                contentTypeId: selectedTemplateId,
                inputs: formInputs,
                referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : null,
                model: shouldSendImageSettings ? selectedModel : null,
                numImages: shouldSendImageSettings ? numImages : null,
                aspectRatio: shouldSendImageSettings ? aspectRatio : null,
                size: shouldSendImageSettings ? size : null,
              }),
            });
          } catch (error) {
            console.error('Error starting background generation:', error);
          }
          
          // Set result with pending status - user can close app now
          setResult({
            ...response.data,
            status: 'pending',
          });
          setShowProgressDialog(false);
        } else {
          // Legacy flow: scenes already generated
          const actualSceneCount = response.data.scenes?.length || 0;
          if (actualSceneCount > 0) {
            setTotalScenes(actualSceneCount);
            simulationRef.current.actualSceneCount = actualSceneCount;
          }
          
          // Update agent responses from actual contributions if available
          if (response.data.scenes?.[0]?.agentContributions) {
            const contributions = response.data.scenes[0].agentContributions;
            
            if (agents.length === 0 && contributions.length > 0) {
              const agentsFromContributions = contributions.map((contrib: any, idx: number) => ({
                id: contrib.agentId || `agent-${idx}`,
                name: contrib.agentName || contrib.agentRole || `Agent ${idx + 1}`,
                role: contrib.agentRole || contrib.agentName || `agent-${idx}`,
                order: contrib.order ?? idx,
              })).sort((a: Agent, b: Agent) => a.order - b.order);
              setAgents(agentsFromContributions);
            }
            
            setAgentResponses(prev => {
              const newMap = new Map(prev);
              contributions.forEach((contrib: any) => {
                newMap.set(contrib.agentId, {
                  status: 'completed',
                  contribution: contrib.contribution,
                  role: contrib.agentRole,
                  timestamp: new Date().toISOString(),
                });
              });
              return newMap;
            });
          }
          setResult(response.data);
          setShowProgressDialog(false);
          
          // Auto-start image generation if reference images are provided
          if (referenceImages.length > 0 && response.data.projectId) {
            startImageGeneration(response.data, referenceImages, selectedModel, numImages, aspectRatio, size, generationMode);
          }
        }
      } else {
        setError('Unexpected response format');
        setCurrentAgentId(null);
        setShowProgressDialog(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCurrentAgentId(null);
      setShowProgressDialog(false);
    } finally {
      setLoading(false);
    }
  };
  
  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('images', file);
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.url;
  };
  
  const startImageGeneration = async (
    projectData: any,
    referenceImages: File[],
    model: string,
    numImages: number,
    aspectRatio: string,
    size: string,
    mode: 'fast' | 'sequential'
  ) => {
    try {
      // Upload reference images
      const referenceImageUrls = await Promise.all(
        referenceImages.map(file => uploadImageToServer(file))
      );

      // Start background image generation
      const response = await fetch('/api/generate-all-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectData.projectId,
          scenes: projectData.scenes,
          referenceImageUrls: referenceImageUrls,
          model,
          numImages,
          aspectRatio,
          size,
          generationMode: mode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to start image generation:', errorData.error);
        // Don't show alert - just log the error
      }
    } catch (error) {
      console.error('Error starting image generation:', error);
      // Don't show alert - just log the error
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setReferenceImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartNew = () => {
    setResult(null);
    setError(null);
    setFormInputs({});
    setSelectedTemplateId('');
    setReferenceImages([]);
    setSelectedModel('flux-schnell');
    setNumImages(1);
    setAspectRatio('9:16');
    setSize('4K');
    setGenerationMode('fast');
    const form = document.getElementById('project-form') as HTMLFormElement;
    if (form) form.reset();
  };

  if (result) {
    return <ProjectResults result={result} onStartNew={handleStartNew} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      {/* Form Section */}
      <div className="lg:col-span-2">
        <div className="card">
          <form id="project-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="contentTypeId" className="block text-sm font-medium text-white mb-2">
                Content Type *
              </label>
              <select
                id="contentTypeId"
                name="contentTypeId"
                required
                value={selectedTemplateId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selectedTemplate = templates.find(t => t.id === selectedId);
                  console.log('[CreateProjectForm] Content type selected:', selectedTemplate?.name);
                  setSelectedTemplateId(selectedId);
                }}
                className="input-field min-h-[44px] touch-manipulation"
              >
                <option value="">Select content type...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {contentType && (
                <p className="mt-1 text-sm text-gray-400">
                  {contentType.description || `Category: ${contentType.category}`}
                </p>
              )}
            </div>

            {contentType && (
              <DynamicFormFields
                contentType={contentType}
                formData={formInputs}
                onChange={setFormInputs}
              />
            )}

            {/* Image Generation Settings */}
            <div className="border-t border-gray-800 pt-5 mt-5">
              <h3 className="text-base font-semibold text-white mb-4">Image Generation Settings</h3>
              
              {/* Generation Mode Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">
                  Generation Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="generationMode"
                      value="fast"
                      checked={generationMode === 'fast'}
                      onChange={(e) => setGenerationMode(e.target.value as 'fast' | 'sequential')}
                      className="w-4 h-4 text-[#D1FE17] bg-gray-800 border-gray-600 focus:ring-[#D1FE17]"
                    />
                    <span className="text-sm text-white">Generate all images (faster)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="generationMode"
                      value="sequential"
                      checked={generationMode === 'sequential'}
                      onChange={(e) => setGenerationMode(e.target.value as 'fast' | 'sequential')}
                      className="w-4 h-4 text-[#D1FE17] bg-gray-800 border-gray-600 focus:ring-[#D1FE17]"
                    />
                    <span className="text-sm text-white">Sequential (consistent)</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {generationMode === 'fast' 
                    ? 'All images will be generated in parallel for faster completion.'
                    : 'Images will be generated one by one, with each scene using the previous scene\'s output as a reference for consistency.'}
                </p>
              </div>
              
              {/* Model Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">
                  AI Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    // Clear reference images when switching to Flux-Schnell
                    if (e.target.value === 'flux-schnell') {
                      setReferenceImages([]);
                    }
                  }}
                  className="input-field"
                >
                  <option value="flux-schnell">Flux Schnell</option>
                  <option value="seedream-4.5">Seedream 4.5</option>
                  <option value="nano-banana-pro">Nano Banana Pro</option>
                  <option value="nano-banana">Nano Banana</option>
                </select>
                {selectedModel === 'flux-schnell' && (
                  <p className="mt-1 text-xs text-gray-400">
                    Flux Schnell doesn't require reference images - it generates images from text prompts only.
                  </p>
                )}
              </div>

              {/* Reference Images Upload - Hidden for Flux-Schnell */}
              {selectedModel !== 'flux-schnell' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">
                    Reference Images
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Images will be automatically generated after scenes are created if reference images are provided.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-700 rounded-xl hover:border-[#D1FE17] transition-colors duration-200 text-gray-400"
                  >
                    <div className="flex flex-col items-center">
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Click to upload reference images</span>
                    </div>
                  </button>
                  {referenceImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {referenceImages.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Number of Images */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">
                  Number of Images per Scene
                </label>
                <select
                  value={numImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  className="input-field"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="input-field"
                >
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                  <option value="9:16">9:16</option>
                </select>
              </div>

              {/* Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">
                  Size
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSize('2K')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      size === '2K'
                        ? 'border-[#D1FE17] bg-[#D1FE17]/20 text-[#D1FE17] font-medium'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    2K
                  </button>
                  <button
                    type="button"
                    onClick={() => setSize('4K')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      size === '4K'
                        ? 'border-[#D1FE17] bg-[#D1FE17]/20 text-[#D1FE17] font-medium'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    4K
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-800">
                {error}
              </div>
            )}

            {loading && agents.length > 0 && (
              <AgentProgressFlow
                agents={agents}
                currentAgentId={currentAgentId}
                completedAgents={completedAgents}
                agentResponses={agentResponses}
                currentScene={currentScene}
                totalScenes={totalScenes}
                isFinalizing={isFinalizing}
                isOpen={showProgressDialog}
                onClose={() => setShowProgressDialog(false)}
              />
            )}

            <button
              type="submit"
              disabled={loading || !selectedTemplateId}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? 'Generating...' : 'Generate Content'}
            </button>
          </form>
        </div>
      </div>

      {/* Information Section */}
      <div className="lg:col-span-1">
        <div className="bg-gray-900 rounded-xl p-6 sticky top-6">
          <h3 className="text-lg font-semibold text-white mb-4">Form Guide</h3>
          <div className="space-y-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-white mb-1">Content Type</h4>
              <p className="text-sm text-gray-400">
                Select a content type that defines the style, structure, and rules for your content generation.
              </p>
            </div>
            {contentType && (
              <>
                <div>
                  <h4 className="font-medium text-white mb-1">Dynamic Fields</h4>
                  <p className="text-sm text-gray-400">
                    The form fields below are dynamically generated based on the selected content type's input contract.
                    Required fields are marked with an asterisk (*).
                  </p>
                </div>
                {contentType.inputsContract.fields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-white mb-1">Available Fields</h4>
                    <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                      {contentType.inputsContract.fields.map((field) => (
                        <li key={field.key}>
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
