'use client';

import { useState, useEffect } from 'react';
import AgentBreakdownDialog from './AgentBreakdownDialog';
import GenerationBreakdownDialog from './GenerationBreakdownDialog';
import ImageGenerationDialog from './ImageGenerationDialog';
import ImageCarousel from './ImageCarousel';
import ImageViewer from './ImageViewer';
import { updateProjectImages } from '@/app/app/actions';

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
      // New schema fields (storyboard_v1)
      id?: string;
      purpose?: string;
      imagePrompt?: string;
      negativePrompt?: string;
      camera?: {
        shot?: string;
        lens?: string;
        movement?: string;
      } | string; // Support both object and string for backward compatibility
      environment?: {
        location?: string;
        timeOfDay?: string;
        lighting?: string;
      };
      onScreenText?: {
        text?: string;
        styleNotes?: string;
      } | string; // Support both object and string for backward compatibility
      compositionNotes?: string;
      generationContext?: {
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
      // Legacy fields (for backward compatibility)
      index?: number;
      shotType?: string;
      notes?: string;
      durationSeconds?: number;
      agentContributions?: AgentContribution[];
      finalAssembler?: FinalAssembler;
      imageUrls?: string[]; // Generated image URLs
    }>;
    renderingSpec?: {
      aspectRatio?: string;
      style?: string;
      imageModelHint?: string;
      colorGrade?: string;
      lightingMood?: string;
      musicMood?: string; // Legacy
      transitions?: string; // Legacy
    };
    videoUrl?: string;
    templateName?: string;
    contentTypeName?: string;
    projectId?: string; // Project ID for saving images
    requestId?: string; // Content creation request ID
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

  // Load existing images from scene.imageUrls when component mounts or result changes
  useEffect(() => {
    const existingImages: GeneratedImage[] = result.scenes.flatMap((scene, idx) => {
      const sceneIndex = scene.index ?? (idx + 1);
      return (scene.imageUrls || []).map((url, imgIdx) => ({
        sceneIndex,
        url,
        generating: false,
        imageIndex: imgIdx,
      }));
    });
    
    if (existingImages.length > 0) {
      setGeneratedImages(existingImages);
    }
  }, [result.scenes]);

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
      template: result.templateName || result.contentTypeName,
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

  const totalDuration = result.scenes.reduce((sum: number, scene: any) => {
    // Note: durationSeconds may not be present in new schema (image-first generation)
    return sum + (scene.durationSeconds || 0);
  }, 0);

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

    // Track generated images locally for saving to database
    const successfulImages: Array<{ sceneIndex: number; url: string }> = [];

    try {
      // Upload reference images
      const referenceImageUrls = await Promise.all(
        referenceImages.map(file => uploadImageToServer(file))
      );
      const primaryReferenceUrl = referenceImageUrls[0];

      // Generate images for each scene
      for (const scene of result.scenes) {
        const sceneIndex = scene.index ?? (result.scenes.indexOf(scene) + 1);
        const imagePrompt = scene.imagePrompt ?? '';
        
        if (!imagePrompt) {
          console.warn(`Skipping scene ${sceneIndex}: no image prompt available`);
          continue;
        }
        
        // Add placeholders for this scene (one per image requested)
        for (let i = 0; i < numImages; i++) {
          setGeneratedImages(prev => [
            ...prev,
            { sceneIndex, url: '', generating: true, imageIndex: i },
          ]);
        }

        // Make multiple API calls (one per requested image)
        for (let imageIndex = 0; imageIndex < numImages; imageIndex++) {
          try {
            const response = await fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scenePrompt: imagePrompt,
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
              const imageUrl = data.images[0];
              successfulImages.push({
                sceneIndex,
                url: imageUrl,
              });

              setGeneratedImages(prev => {
                const updated = [...prev];
                const index = updated.findIndex(
                  img => img.sceneIndex === sceneIndex && 
                         img.generating && 
                         (img.imageIndex ?? 0) === imageIndex
                );
                if (index !== -1) {
                  updated[index] = {
                    sceneIndex,
                    url: imageUrl,
                    generating: false,
                    imageIndex: imageIndex,
                  };
                }
                return updated;
              });
            }
          } catch (error) {
            console.error(`Error generating image ${imageIndex + 1} for scene ${sceneIndex}:`, error);
            // Remove failed placeholder
            setGeneratedImages(prev =>
              prev.filter(img => !(
                img.sceneIndex === sceneIndex && 
                img.generating && 
                (img.imageIndex ?? 0) === imageIndex
              ))
            );
          }
        }
      }

      // Save generated images to database if projectId is available
      if (result.projectId && successfulImages.length > 0) {
        try {
          const saveResult = await updateProjectImages(result.projectId, successfulImages);
          if (saveResult.error) {
            console.error('Error saving images to database:', saveResult.error);
          } else {
            console.log('Images saved to database successfully');
          }
        } catch (error) {
          console.error('Error saving images to database:', error);
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
          Content Type: {result.templateName || result.contentTypeName || 'Unknown'}
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
          {result.scenes.map((scene: any, idx: number) => {
            // Support both new and old schema formats
            const sceneIndex = scene.index ?? (idx + 1);
            const scenePurpose = scene.purpose ?? scene.shotType ?? 'Scene';
            const imagePrompt = scene.imagePrompt ?? '';
            const cameraText = typeof scene.camera === 'string' 
              ? scene.camera 
              : scene.camera?.shot 
                ? `${scene.camera.shot}${scene.camera.lens ? `, ${scene.camera.lens}` : ''}${scene.camera.movement ? `, ${scene.camera.movement}` : ''}`
                : '';
            const onScreenTextValue = typeof scene.onScreenText === 'string'
              ? scene.onScreenText
              : scene.onScreenText?.text ?? '';
            
            const isExpanded = expandedScenes.has(sceneIndex);
            const previewText = imagePrompt && imagePrompt.length > 100 
              ? imagePrompt.substring(0, 100) + '...' 
              : imagePrompt || 'No prompt available';

            return (
              <div key={sceneIndex} className="border border-gray-200 rounded-xl overflow-hidden transition-all">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => toggleScene(sceneIndex)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-medium text-gray-900">Scene {sceneIndex}</h3>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium">
                  {scenePurpose}
                </span>
                        {/* Always show info icon if generation context exists */}
                        {(scene.generationContext || scene.agentContributions) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScene(sceneIndex);
                            }}
                            className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="View generation breakdown"
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
                        toggleScene(sceneIndex);
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
                      {imagePrompt && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Image Prompt:</span> {imagePrompt}
                        </p>
                      )}
                      {scene.negativePrompt && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Negative Prompt:</span> {scene.negativePrompt}
                        </p>
                      )}
                      {cameraText && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Camera:</span> {cameraText}
                        </p>
                      )}
                      {scene.environment && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">Environment:</span> {
                            [
                              scene.environment.location,
                              scene.environment.timeOfDay,
                              scene.environment.lighting
                            ].filter(Boolean).join(', ') || 'Not specified'
                          }
                        </p>
                      )}
                      {onScreenTextValue && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          <span className="font-medium">On-screen Text:</span> {onScreenTextValue}
                          {typeof scene.onScreenText === 'object' && scene.onScreenText?.styleNotes && (
                            <span className="text-gray-500 ml-2">({scene.onScreenText.styleNotes})</span>
                          )}
                        </p>
                      )}
                      {(scene.compositionNotes || scene.notes) && (
                        <p className="text-xs sm:text-sm text-gray-500 italic">
                          {scene.compositionNotes || scene.notes}
                        </p>
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

      {result.renderingSpec && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Rendering Spec</h2>
          <div className="space-y-2 text-sm sm:text-base">
            {result.renderingSpec.aspectRatio && (
              <p>
                <span className="font-medium">Aspect Ratio:</span> {result.renderingSpec.aspectRatio}
              </p>
            )}
            {result.renderingSpec.style && (
              <p>
                <span className="font-medium">Style:</span> {result.renderingSpec.style}
              </p>
            )}
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
      )}

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

      {/* Generation Breakdown Dialog */}
      {selectedScene !== null && (() => {
        const scene = result.scenes.find((s, idx) => (s.index ?? (idx + 1)) === selectedScene);
        if (!scene) return null;
        const sceneIndex = scene.index ?? (result.scenes.indexOf(scene) + 1);
        const scenePurpose = scene.purpose ?? scene.shotType ?? 'Scene';
        const imagePrompt = scene.imagePrompt ?? '';
        
        // Use new generation context if available, otherwise fall back to agent contributions
        if (scene.generationContext) {
          return (
            <GenerationBreakdownDialog
              sceneIndex={sceneIndex}
              sceneType={scenePurpose}
              finalPrompt={imagePrompt}
              generationContext={scene.generationContext}
              agentContributions={scene.agentContributions}
              onClose={() => setSelectedScene(null)}
            />
          );
        } else {
          return (
            <AgentBreakdownDialog
              sceneIndex={sceneIndex}
              sceneType={scenePurpose}
              finalPrompt={imagePrompt}
              agentContributions={scene.agentContributions}
              finalAssembler={scene.finalAssembler}
              onClose={() => setSelectedScene(null)}
            />
          );
        }
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

