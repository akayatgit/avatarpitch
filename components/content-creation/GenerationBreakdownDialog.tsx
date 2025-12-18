'use client';

import { useState } from 'react';

interface AgentContribution {
  agentId: string;
  agentName: string;
  agentRole: string;
  order: number;
  contribution?: Record<string, any>;
  input?: Record<string, any>;
  output?: Record<string, any>;
}

interface GenerationBreakdownDialogProps {
  sceneIndex: number;
  sceneType: string;
  finalPrompt: string;
  generationContext: {
    inputs: any;
    contentTypeName: string;
    systemPrompt: string;
    userPromptContext?: {
      goal?: string;
      platform?: string;
      language?: string;
      tone?: string;
      subjectName?: string;
      subjectType?: string;
      offerText?: string;
      audienceDesc?: string;
      productInfo?: string;
      storyInfo?: string;
      sceneCount?: number;
      rules?: any;
    };
    scenePurpose?: string;
    sceneSpecificContext?: {
      purpose?: string;
      camera?: any;
      environment?: any;
      onScreenText?: any;
    };
  };
  agentContributions?: AgentContribution[];
  onClose: () => void;
}

export default function GenerationBreakdownDialog({
  sceneIndex,
  sceneType,
  finalPrompt,
  generationContext,
  agentContributions = [],
  onClose,
}: GenerationBreakdownDialogProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const context = generationContext.userPromptContext || {};
  const inputs = generationContext.inputs || {};

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  // Sort agent contributions by order
  const sortedContributions = [...agentContributions].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Generation Breakdown: Scene {sceneIndex}
            </h2>
            <p className="text-sm text-gray-600 mt-1">Purpose: {sceneType}</p>
            <p className="text-xs text-gray-500 mt-1">Content Type: {generationContext.contentTypeName}</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Final Prompt */}
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">Final Image Prompt</h3>
          <p className="text-sm text-purple-800">{finalPrompt}</p>
        </div>

        {/* Agent Contributions */}
        {sortedContributions.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Agent Contributions ({sortedContributions.length})
            </h3>
            <div className="space-y-3">
              {sortedContributions.map((contrib, idx) => {
                const isExpanded = expandedAgents.has(contrib.agentId);
                const agentOutput = contrib.contribution || contrib.output || {};
                
                return (
                  <div
                    key={contrib.agentId}
                    className="border border-gray-200 rounded-lg overflow-hidden bg-white"
                  >
                    <button
                      onClick={() => toggleAgent(contrib.agentId)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                          {contrib.order}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{contrib.agentName}</div>
                          <div className="text-xs text-gray-500">{contrib.agentRole}</div>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                        <div className="pt-4 space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">Agent Output:</h4>
                            <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                              {JSON.stringify(agentOutput, null, 2)}
                            </pre>
                          </div>
                          {contrib.input && Object.keys(contrib.input).length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">Agent Input:</h4>
                              <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-40 overflow-y-auto">
                                {JSON.stringify(contrib.input, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Context */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Inputs Used for Generation
          </h3>
          <div className="space-y-3">
            {context.goal && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Content Goal:</span>
                <span className="text-sm text-gray-900 ml-2 capitalize">{context.goal}</span>
              </div>
            )}
            {context.platform && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Platform:</span>
                <span className="text-sm text-gray-900 ml-2 capitalize">{context.platform}</span>
              </div>
            )}
            {context.subjectName && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Subject:</span>
                <span className="text-sm text-gray-900 ml-2">{context.subjectName}</span>
                {context.subjectType && (
                  <span className="text-xs text-gray-600 ml-2">({context.subjectType})</span>
                )}
              </div>
            )}
            {context.offerText && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Offer:</span>
                <span className="text-sm text-gray-900 ml-2">{context.offerText}</span>
              </div>
            )}
            {context.audienceDesc && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Target Audience:</span>
                <span className="text-sm text-gray-900 ml-2">{context.audienceDesc}</span>
              </div>
            )}
            {context.tone && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Tone:</span>
                <span className="text-sm text-gray-900 ml-2">{context.tone}</span>
              </div>
            )}
            {inputs.subject?.product && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Product Details:</span>
                <div className="text-xs text-gray-900 mt-1 space-y-1">
                  {inputs.subject.product.category && (
                    <div>Category: {inputs.subject.product.category}</div>
                  )}
                  {inputs.subject.product.material && (
                    <div>Material: {inputs.subject.product.material}</div>
                  )}
                  {inputs.subject.product.colors && inputs.subject.product.colors.length > 0 && (
                    <div>Colors: {inputs.subject.product.colors.join(', ')}</div>
                  )}
                  {inputs.subject.product.keyPoints && inputs.subject.product.keyPoints.length > 0 && (
                    <div>Description: {inputs.subject.product.keyPoints.join(', ')}</div>
                  )}
                </div>
              </div>
            )}
            {inputs.subject?.story && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <span className="text-xs font-medium text-gray-700">Story Details:</span>
                <div className="text-xs text-gray-900 mt-1 space-y-1">
                  {inputs.subject.story.characters && inputs.subject.story.characters.length > 0 && (
                    <div>Characters: {inputs.subject.story.characters.join(', ')}</div>
                  )}
                  {inputs.subject.story.setting && (
                    <div>Setting: {inputs.subject.story.setting}</div>
                  )}
                  {inputs.subject.story.theme && (
                    <div>Theme: {inputs.subject.story.theme}</div>
                  )}
                  {inputs.subject.story.conflict && (
                    <div>Conflict: {inputs.subject.story.conflict}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scene-Specific Context */}
        {generationContext.sceneSpecificContext && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Scene-Specific Decisions
            </h3>
            <div className="space-y-3">
              {generationContext.sceneSpecificContext.purpose && (
                <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
                  <span className="text-xs font-medium text-blue-900">Purpose:</span>
                  <span className="text-sm text-blue-800 ml-2">{generationContext.sceneSpecificContext.purpose}</span>
                </div>
              )}
              {generationContext.sceneSpecificContext.camera && Object.keys(generationContext.sceneSpecificContext.camera).length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
                  <span className="text-xs font-medium text-blue-900">Camera:</span>
                  <div className="text-xs text-blue-800 mt-1">
                    {typeof generationContext.sceneSpecificContext.camera === 'object' ? (
                      <>
                        {generationContext.sceneSpecificContext.camera.shot && (
                          <div>Shot: {generationContext.sceneSpecificContext.camera.shot}</div>
                        )}
                        {generationContext.sceneSpecificContext.camera.lens && (
                          <div>Lens: {generationContext.sceneSpecificContext.camera.lens}</div>
                        )}
                        {generationContext.sceneSpecificContext.camera.movement && (
                          <div>Movement: {generationContext.sceneSpecificContext.camera.movement}</div>
                        )}
                      </>
                    ) : (
                      <div>{generationContext.sceneSpecificContext.camera}</div>
                    )}
                  </div>
                </div>
              )}
              {generationContext.sceneSpecificContext.environment && Object.keys(generationContext.sceneSpecificContext.environment).length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
                  <span className="text-xs font-medium text-blue-900">Environment:</span>
                  <div className="text-xs text-blue-800 mt-1">
                    {generationContext.sceneSpecificContext.environment.location && (
                      <div>Location: {generationContext.sceneSpecificContext.environment.location}</div>
                    )}
                    {generationContext.sceneSpecificContext.environment.timeOfDay && (
                      <div>Time of Day: {generationContext.sceneSpecificContext.environment.timeOfDay}</div>
                    )}
                    {generationContext.sceneSpecificContext.environment.lighting && (
                      <div>Lighting: {generationContext.sceneSpecificContext.environment.lighting}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generation Rules Applied */}
        {context.rules && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Generation Rules Applied
            </h3>
            <ul className="text-xs text-gray-700 space-y-1">
              {context.rules.mustStartStrong && (
                <li>• First scene must start strong (hook-like opening)</li>
              )}
              {context.rules.mustEndWithClosure && (
                <li>• Last scene must end with closure (CTA, payoff, conclusion)</li>
              )}
              {context.rules.avoidRepetition && (
                <li>• Avoid repetition in purpose, shot, or location</li>
              )}
              {context.rules.platformAwareOrdering && (
                <li>• Order scenes appropriately for the platform</li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
