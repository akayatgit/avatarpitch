'use client';

import { useState, useEffect } from 'react';
import ProjectResults from './ProjectResults';
import AgentProgressFlow from './AgentProgressFlow';

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set());
  const [agentResponses, setAgentResponses] = useState<Map<string, any>>(new Map());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [totalScenes, setTotalScenes] = useState<number>(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Fetch agents when template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setAgents([]);
      return;
    }

    const fetchAgents = async () => {
      try {
        const response = await fetch(`/api/templates/${selectedTemplateId}`);
        if (response.ok) {
          const data = await response.json();
          const workflow = data.template?.config?.workflow?.agentWorkflow;
          if (workflow?.agents) {
            const sortedAgents = [...workflow.agents]
              .sort((a: Agent, b: Agent) => a.order - b.order)
              .map((agent: any) => ({
                id: agent.id,
                name: agent.name,
                role: agent.role,
                order: agent.order,
              }));
            setAgents(sortedAgents);
          }
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      }
    };

    fetchAgents();
  }, [selectedTemplateId]);

  const simulateProgressForScene = async (agents: Agent[], sceneNumber: number) => {
    // Reset progress for this scene
    setCompletedAgents(new Set());
    setAgentResponses(new Map());
    setCurrentAgentId(null);
    setCurrentScene(sceneNumber);

    // Simulate agent execution with estimated times
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      setCurrentAgentId(agent.id);
      
      // Estimate time: 2-4 seconds per agent
      const delay = 2000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Mark as completed
      setCompletedAgents(prev => new Set([...prev, agent.id]));
      
      // Simulate response (we'll get real response later)
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

  const simulateAllScenes = async (agents: Agent[], sceneCount: number) => {
    setShowProgressDialog(true);
    setIsFinalizing(false);
    
    // Simulate progress for each scene
    for (let sceneNum = 1; sceneNum <= sceneCount; sceneNum++) {
      await simulateProgressForScene(agents, sceneNum);
      // Small delay between scenes
      if (sceneNum < sceneCount) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // After all scenes are done, show finalizing state
    setIsFinalizing(true);
    setCurrentScene(0); // Hide scene counter
    
    // Keep dialog open briefly to show finalizing message
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

    const formData = new FormData(e.currentTarget);
    formData.set('features', features);

    // Get scene count from template
    let sceneCount = 5; // default
    if (selectedTemplateId) {
      try {
        const response = await fetch(`/api/templates/${selectedTemplateId}`);
        if (response.ok) {
          const data = await response.json();
          sceneCount = data.template?.config?.output?.sceneCount || 5;
        }
      } catch (err) {
        console.error('Failed to fetch scene count:', err);
      }
    }
    setTotalScenes(sceneCount);

    // Start progress simulation for all scenes
    if (agents.length > 0) {
      simulateAllScenes(agents, sceneCount).catch(console.error);
    }

    try {
      const response = await generateProject(formData);
      if (response.error) {
        setError(response.error);
        setCurrentAgentId(null);
        setShowProgressDialog(false);
      } else if (response.success && response.data) {
        // Update with real agent responses if available
        if (response.data.scenes?.[0]?.agentContributions) {
          const contributions = response.data.scenes[0].agentContributions;
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
    setFeatures('');
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
          <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-2">
            Content Type *
          </label>
          <select
            id="templateId"
            name="templateId"
            required
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="input-field min-h-[44px] touch-manipulation"
          >
            <option value="">Select content type...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-2">
            Product Name *
          </label>
          <input
            type="text"
            id="productName"
            name="productName"
            required
            className="input-field min-h-[44px] touch-manipulation"
            placeholder="e.g., Winter Cozy Sweater"
          />
        </div>

        <div>
          <label htmlFor="productLink" className="block text-sm font-medium text-gray-700 mb-2">
            Product Link (optional)
          </label>
          <input
            type="url"
            id="productLink"
            name="productLink"
            className="input-field min-h-[44px] touch-manipulation"
            placeholder="https://example.com/product"
          />
        </div>

        <div>
          <label htmlFor="offer" className="block text-sm font-medium text-gray-700 mb-2">
            Offer (optional)
          </label>
          <input
            type="text"
            id="offer"
            name="offer"
            className="input-field min-h-[44px] touch-manipulation"
            placeholder="e.g., 20% off, Free shipping, Buy 2 Get 1"
          />
        </div>

        <div>
          <label htmlFor="features" className="block text-sm font-medium text-gray-700 mb-2">
            Features (optional, comma-separated, max 5)
          </label>
          <input
            type="text"
            id="features"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            className="input-field min-h-[44px] touch-manipulation"
            placeholder="e.g., Warm, Soft, Durable, Machine washable"
          />
        </div>

        <div>
          <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience (optional)
          </label>
          <input
            type="text"
            id="targetAudience"
            name="targetAudience"
            className="input-field min-h-[44px] touch-manipulation"
            placeholder="e.g., Young professionals, Fashion enthusiasts"
          />
        </div>

        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-2">
            Platform (optional)
          </label>
          <select
            id="platform"
            name="platform"
            className="input-field min-h-[44px] touch-manipulation"
          >
            <option value="">Select platform...</option>
            <option value="TikTok">TikTok</option>
            <option value="Reels">Reels</option>
            <option value="Shorts">Shorts</option>
          </select>
        </div>

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
          disabled={loading}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {loading ? 'Generating...' : 'Generate Project'}
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
              <p className="text-sm text-gray-400">Select a pre-configured content type that defines the style and structure of your video ad.</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Product Name</h4>
              <p className="text-sm text-gray-400">Enter the name of your product. This will be featured prominently in your ad.</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Product Link</h4>
              <p className="text-sm text-gray-400">Optional. Add a URL where customers can purchase or learn more about your product.</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Offer</h4>
              <p className="text-sm text-gray-400">Specify your promotion or discount. Examples: "20% off", "Free shipping", "Buy 2 Get 1".</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Features</h4>
              <p className="text-sm text-gray-400">List key product features separated by commas. Maximum 5 features recommended.</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Target Audience</h4>
              <p className="text-sm text-gray-400">Describe your ideal customer. This helps AI tailor the ad content and messaging.</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-500 mb-1">Platform</h4>
              <p className="text-sm text-gray-400">Choose the social media platform where your ad will be published. Each platform has different format requirements.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

