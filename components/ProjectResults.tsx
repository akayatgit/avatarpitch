'use client';

import { useState } from 'react';
import AgentBreakdownDialog from './AgentBreakdownDialog';
import ImageGenerationDialog from './ImageGenerationDialog';
import ImageCarousel from './ImageCarousel';
import ImageViewer from './ImageViewer';

interface AgentContribution {
  agentId: string;
  agentName: string;
  agentRole: string;
  order: number;
  contribution: any;
  writesTo: string[];
}

interface FinalAssembler {
  agentId: string;
  agentName: string;
  agentRole: string;
  sharedStateUsed: any;
}

interface ProjectResultsProps {
  result: {
    scenes: Array<{
      index: number;
      shotType: string;
      camera: string;
      imagePrompt: string;
      negativePrompt?: string;
      onScreenText?: string;
      notes?: string;
      durationSeconds?: number; // Optional for image-first
      agentContributions?: AgentContribution[];
      finalAssembler?: FinalAssembler;
    }>;
    renderingSpec: {
      aspectRatio: string;
      style: string;
      imageModelHint?: string;
      colorGrade?: string;
      lightingMood?: string;
      musicMood?: string; // Legacy
      transitions?: string; // Legacy
    };
    videoUrl: string;
    workspaceName: string;
    templateName: string;
  };
  onStartNew: () => void;
}

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  generating?: boolean;
  imageIndex?: number;
}

export default function ProjectResults({ result, onStartNew }: ProjectResultsProps) {
  const [downloading, setDownloading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const toggleScene = (sceneIndex: number) => {
    setExpandedScenes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sceneIndex)) {
        newSet.delete(sceneIndex);
      } else {
        newSet.add(sceneIndex);
      }
      return newSet;
    });
  };

  const handleDownload = () => {
    setDownloading(true);
    const bundle = {
      workspace: result.workspaceName,
      template: result.templateName,
      generatedAt: new Date().toISOString(),
      scenes: result.scenes,
      renderingSpec: result.renderingSpec,
      videoUrl: result.videoUrl,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'render-bundle.image-first.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const totalDuration = result.scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 0), 0);

  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('images', file);
    
    // Use our proxy API route to avoid CORS issues
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

  const handleGenerateImages = async (referenceImages: File[], model: string, numImages: number, aspectRatio: string, size: string) => {
    setShowImageDialog(false);
    setGeneratingImages(true);
    setGeneratedImages([]);

    try {
      // Upload reference images
      const referenceImageUrls = await Promise.all(
        referenceImages.map(file => uploadImageToServer(file))
      );
      const primaryReferenceUrl = referenceImageUrls[0];

      // Generate images for each scene
      for (const scene of result.scenes) {
        // Add placeholders for this scene (one per image requested)
        for (let i = 0; i < numImages; i++) {
          setGeneratedImages(prev => [
            ...prev,
            { sceneIndex: scene.index, url: '', generating: true, imageIndex: i },
          ]);
        }

        // Make multiple API calls (one per requested image)
        for (let imageIndex = 0; imageIndex < numImages; imageIndex++) {
          try {
            const response = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scenePrompt: scene.imagePrompt,
                referenceImageUrl: primaryReferenceUrl,
                model,
                screenshotUrl: primaryReferenceUrl, // Using reference as screenshot for now
                numImages: 1, // Always request 1 image per call
                aspectRatio,
                size,
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to generate image');
            }

            const data = await response.json();
            
            // Update the specific placeholder with the generated image
            if (data.images && data.images.length > 0) {
              setGeneratedImages(prev => {
                const updated = [...prev];
                const index = updated.findIndex(
                  img => img.sceneIndex === scene.index && 
                         img.generating && 
                         (img.imageIndex ?? 0) === imageIndex
                );
                if (index !== -1) {
                  updated[index] = {
                    sceneIndex: scene.index,
                    url: data.images[0], // Take the first (and likely only) image
                    generating: false,
                    imageIndex: imageIndex,
                  };
                }
                return updated;
              });
            }
          } catch (error) {
            console.error(`Error generating image ${imageIndex + 1} for scene ${scene.index}:`, error);
            // Remove failed placeholder
            setGeneratedImages(prev =>
              prev.filter(img => !(
                img.sceneIndex === scene.index && 
                img.generating && 
                (img.imageIndex ?? 0) === imageIndex
              ))
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in image generation:', error);
    } finally {
      setGeneratingImages(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm sm:text-base text-green-800 font-medium">Project generated successfully!</p>
        <p className="text-xs sm:text-sm text-green-600 mt-1">
          Workspace: {result.workspaceName} | Template: {result.templateName}
        </p>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Generated Scenes</h2>
          <button
            onClick={() => setShowImageDialog(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Generate Images
          </button>
          </div>
        <div className="space-y-3 sm:space-y-4">
          {result.scenes.map((scene) => {
            const isExpanded = expandedScenes.has(scene.index);
            const previewText = scene.imagePrompt.length > 100 
              ? scene.imagePrompt.substring(0, 100) + '...' 
              : scene.imagePrompt;

            return (
              <div key={scene.index} className="border border-gray-200 rounded-xl overflow-hidden transition-all">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => toggleScene(scene.index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-medium text-gray-900">Scene {scene.index}</h3>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium">
                  {scene.shotType}
                </span>
                        {scene.agentContributions && scene.agentContributions.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScene(scene.index);
                            }}
                            className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="View agent breakdown"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Image Prompt:</span> {previewText}
                        </p>
                      )}
                    </div>
                    <button
                      className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScene(scene.index);
                      }}
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
              </div>
                
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                    <div className="pt-4 space-y-2">
                      <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">Image Prompt:</span> {scene.imagePrompt}
              </p>
              {scene.negativePrompt && (
                        <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Negative Prompt:</span> {scene.negativePrompt}
                </p>
              )}
                      <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">Camera:</span> {scene.camera}
              </p>
              {scene.onScreenText && (
                        <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">On-screen Text:</span> {scene.onScreenText}
                </p>
              )}
              {scene.notes && (
                <p className="text-xs sm:text-sm text-gray-500 italic">{scene.notes}</p>
              )}
            </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {generatedImages.length > 0 && (
        <ImageCarousel
          images={generatedImages}
          onImageClick={setSelectedImage}
        />
      )}

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Rendering Spec</h2>
        <div className="space-y-2 text-sm sm:text-base">
          <p>
            <span className="font-medium">Aspect Ratio:</span> {result.renderingSpec.aspectRatio}
          </p>
          <p>
            <span className="font-medium">Style:</span> {result.renderingSpec.style}
          </p>
          {result.renderingSpec.imageModelHint && (
            <p>
              <span className="font-medium">Image Model:</span> {result.renderingSpec.imageModelHint}
            </p>
          )}
          {result.renderingSpec.colorGrade && (
            <p>
              <span className="font-medium">Color Grade:</span> {result.renderingSpec.colorGrade}
            </p>
          )}
          {result.renderingSpec.lightingMood && (
            <p>
              <span className="font-medium">Lighting:</span> {result.renderingSpec.lightingMood}
            </p>
          )}
          {result.renderingSpec.musicMood && (
            <p>
              <span className="font-medium">Music Mood:</span> {result.renderingSpec.musicMood}
            </p>
          )}
          {result.renderingSpec.transitions && (
            <p>
              <span className="font-medium">Transitions:</span> {result.renderingSpec.transitions}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 inline-flex justify-center items-center px-6 py-3.5 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-purple-600 active:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all touch-manipulation min-h-[44px]"
        >
          {downloading ? 'Downloading...' : 'Download Render Bundle'}
        </button>
        <button
          onClick={onStartNew}
          className="flex-1 inline-flex justify-center items-center px-6 py-3.5 border border-gray-300 text-base font-medium rounded-xl text-gray-700 bg-white active:bg-gray-50 active:scale-95 transition-all touch-manipulation min-h-[44px] shadow-sm"
        >
          Start New
        </button>
      </div>

      {/* Agent Breakdown Dialog */}
      {selectedScene !== null && (() => {
        const scene = result.scenes.find(s => s.index === selectedScene);
        if (!scene) return null;
        return (
          <AgentBreakdownDialog
            sceneIndex={scene.index}
            sceneType={scene.shotType}
            finalPrompt={scene.imagePrompt}
            agentContributions={scene.agentContributions}
            finalAssembler={scene.finalAssembler}
            onClose={() => setSelectedScene(null)}
          />
        );
      })()}

      {/* Image Generation Dialog */}
      <ImageGenerationDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        onGenerate={handleGenerateImages}
        generating={generatingImages}
      />

      {/* Image Viewer */}
      <ImageViewer
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}

