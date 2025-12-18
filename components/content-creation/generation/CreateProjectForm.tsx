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
}

interface Agent {
  id: string;
  name: string;
  role: string;
  order: number;
}

export default function CreateProjectForm({ templates, generateProject }: CreateProjectFormProps) {
  console.log('[CreateProjectForm] Component rendered:', {
    templatesCount: templates.length
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
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
        const response = await fetch(`/api/content-types/${selectedTemplateId}`);
        
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
      
      const delay = 2000 + Math.random() * 2000;
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

  const simulateAllScenes = async (agents: Agent[], estimatedSceneCount: number) => {
    setShowProgressDialog(true);
    setIsFinalizing(false);
    simulationRef.current.stop = false;
    simulationRef.current.actualSceneCount = null;
    
    // Start with estimated count, but check for actual count during simulation
    let currentMaxScenes = estimatedSceneCount;
    
    for (let sceneNum = 1; sceneNum <= currentMaxScenes; sceneNum++) {
      // Check if we have actual scene count and should stop early
      if (simulationRef.current.actualSceneCount !== null) {
        currentMaxScenes = simulationRef.current.actualSceneCount;
        if (sceneNum > currentMaxScenes) {
          break;
        }
      }
      
      // Check if we should stop
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
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsFinalizing(true);
    setCurrentScene(0);
    await new Promise(resolve => setTimeout(resolve, 2000));
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

    // Start progress simulation only if we have agents configured
    // Note: This is a simulation since the actual generation happens on the server
    // The real scene count will be determined by the server and updated when response arrives
    if (agents.length > 0) {
      // Store the simulation promise so we can cancel/update it if needed
      simulateAllScenes(agents, estimatedSceneCount).catch(() => {});
    } else {
      // If no agents, just show a simple loading state
      setShowProgressDialog(true);
      setIsFinalizing(false);
    }

    try {
      const response = await generateProject(formData);
      
      if (response.error) {
        setError(response.error);
        setCurrentAgentId(null);
        setShowProgressDialog(false);
      } else if (response.success && response.data) {
        // Update total scenes to actual generated count IMMEDIATELY
        const actualSceneCount = response.data.scenes?.length || 0;
        if (actualSceneCount > 0) {
          setTotalScenes(actualSceneCount);
          // Update simulation ref so it can adjust
          simulationRef.current.actualSceneCount = actualSceneCount;
        }
        
        // Update agent responses from actual contributions if available
        if (response.data.scenes?.[0]?.agentContributions) {
          const contributions = response.data.scenes[0].agentContributions;
          
          // Also update agents list from contributions if we don't have them yet
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

  const handleStartNew = () => {
    setResult(null);
    setError(null);
    setFormInputs({});
    setSelectedTemplateId('');
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
              <label htmlFor="contentTypeId" className="block text-sm font-medium text-gray-700 mb-2">
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
                <p className="mt-1 text-sm text-gray-500">
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

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
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
        <div className="bg-gray-100 rounded-xl p-6 sticky top-6">
          <h3 className="text-lg font-semibold text-gray-500 mb-4">Form Guide</h3>
          <div className="space-y-4 text-sm text-gray-500">
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Content Type</h4>
              <p className="text-sm text-gray-400">
                Select a content type that defines the style, structure, and rules for your content generation.
              </p>
            </div>
            {contentType && (
              <>
                <div>
                  <h4 className="font-medium text-gray-500 mb-1">Dynamic Fields</h4>
                  <p className="text-sm text-gray-400">
                    The form fields below are dynamically generated based on the selected content type's input contract.
                    Required fields are marked with an asterisk (*).
                  </p>
                </div>
                {contentType.inputsContract.fields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-500 mb-1">Available Fields</h4>
                    <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                      {contentType.inputsContract.fields.map((field) => (
                        <li key={field.key}>
                          {field.label} {field.required && <span className="text-red-500">*</span>}
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
