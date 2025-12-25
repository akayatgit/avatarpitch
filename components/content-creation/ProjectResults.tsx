'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [backgroundGenerationStarted, setBackgroundGenerationStarted] = useState(false);
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const activeRequestsRef = useRef<Map<string, AbortController>>(new Map());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing images from scene.imageUrls when component mounts or result changes
  const loadImagesFromScenes = () => {
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
  };

  useEffect(() => {
    loadImagesFromScenes();
  }, [result.scenes]);

  // Set up polling to check for new images if background generation is in progress
  useEffect(() => {
    if (backgroundGenerationStarted && result.projectId) {
      // Poll every 10 seconds to check for new images
      refreshIntervalRef.current = setInterval(async () => {
        try {
          // Fetch updated project data
          const response = await fetch(`/api/project/${result.projectId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.scenes) {
              // Update result with new scenes data
              const updatedImages: GeneratedImage[] = data.scenes.flatMap((scene: any, idx: number) => {
                const sceneIndex = scene.index ?? (idx + 1);
                return (scene.imageUrls || []).map((url: string, imgIdx: number) => ({
                  sceneIndex,
                  url,
                  generating: false,
                  imageIndex: imgIdx,
                }));
              });
              
              // Update images if we have any (even if count is same, URLs might have changed)
              setGeneratedImages(prev => {
                // Only update if we actually have new or different images
                if (updatedImages.length > 0 && JSON.stringify(updatedImages) !== JSON.stringify(prev)) {
                  return updatedImages;
                }
                return prev;
              });
            }
          }
        } catch (error) {
          console.error('Error polling for new images:', error);
        }
      }, 10000); // Poll every 10 seconds

      // Clean up interval on unmount or when generation stops
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval if background generation is not active
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [backgroundGenerationStarted, result.projectId]);

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

  // Replace placeholders in text with actual input values
  const replacePlaceholders = (text: string, inputs: any): string => {
    if (!text || !inputs) return text;
    
    let replaced = text;
    
    // Product/Subject name - handle all case variations
    const productName = inputs.subject?.name;
    if (productName) {
      // Handle various formats: [PRODUCT NAME], [product name], [Product Name], [PRODUCT_NAME], etc.
      replaced = replaced.replace(/\[PRODUCT\s+NAME\]/gi, productName);
      replaced = replaced.replace(/\[PRODUCT_NAME\]/gi, productName);
      replaced = replaced.replace(/\[SUBJECT\s+NAME\]/gi, productName);
      replaced = replaced.replace(/\[SUBJECT_NAME\]/gi, productName);
      // Also handle lowercase variations explicitly
      replaced = replaced.replace(/\[product\s+name\]/gi, productName);
      replaced = replaced.replace(/\[subject\s+name\]/gi, productName);
    }
    
    // Product category
    if (inputs.subject?.product?.category) {
      replaced = replaced.replace(/\[PRODUCT CATEGORY\]/gi, inputs.subject.product.category);
      replaced = replaced.replace(/\[PRODUCT_CATEGORY\]/gi, inputs.subject.product.category);
      replaced = replaced.replace(/\[CATEGORY\]/gi, inputs.subject.product.category);
    }
    
    // Product material
    if (inputs.subject?.product?.material) {
      replaced = replaced.replace(/\[PRODUCT MATERIAL\]/gi, inputs.subject.product.material);
      replaced = replaced.replace(/\[PRODUCT_MATERIAL\]/gi, inputs.subject.product.material);
      replaced = replaced.replace(/\[MATERIAL\]/gi, inputs.subject.product.material);
    }
    
    // Product fit
    if (inputs.subject?.product?.fit) {
      replaced = replaced.replace(/\[PRODUCT FIT\]/gi, inputs.subject.product.fit);
      replaced = replaced.replace(/\[PRODUCT_FIT\]/gi, inputs.subject.product.fit);
      replaced = replaced.replace(/\[FIT\]/gi, inputs.subject.product.fit);
    }
    
    // Product colors
    if (inputs.subject?.product?.colors && inputs.subject.product.colors.length > 0) {
      const colorsStr = inputs.subject.product.colors.join(', ');
      replaced = replaced.replace(/\[PRODUCT COLORS\]/gi, colorsStr);
      replaced = replaced.replace(/\[PRODUCT_COLORS\]/gi, colorsStr);
      replaced = replaced.replace(/\[COLORS\]/gi, colorsStr);
    }
    
    // Product features/key points
    if (inputs.subject?.product?.keyPoints && inputs.subject.product.keyPoints.length > 0) {
      const featuresStr = inputs.subject.product.keyPoints.join(', ');
      replaced = replaced.replace(/\[PRODUCT FEATURES\]/gi, featuresStr);
      replaced = replaced.replace(/\[PRODUCT_FEATURES\]/gi, featuresStr);
      replaced = replaced.replace(/\[FEATURES\]/gi, featuresStr);
      replaced = replaced.replace(/\[KEY POINTS\]/gi, featuresStr);
      replaced = replaced.replace(/\[KEY_POINTS\]/gi, featuresStr);
    }
    
    // Offer text
    if (inputs.offer?.text) {
      replaced = replaced.replace(/\[OFFER\]/gi, inputs.offer.text);
      replaced = replaced.replace(/\[OFFER TEXT\]/gi, inputs.offer.text);
      replaced = replaced.replace(/\[OFFER_TEXT\]/gi, inputs.offer.text);
    }
    
    // Target audience
    if (inputs.audience?.description) {
      replaced = replaced.replace(/\[TARGET AUDIENCE\]/gi, inputs.audience.description);
      replaced = replaced.replace(/\[TARGET_AUDIENCE\]/gi, inputs.audience.description);
      replaced = replaced.replace(/\[AUDIENCE\]/gi, inputs.audience.description);
    }
    
    // Platform
    if (inputs.platform) {
      replaced = replaced.replace(/\[PLATFORM\]/gi, inputs.platform);
    }
    
    // Goal
    if (inputs.goal) {
      replaced = replaced.replace(/\[GOAL\]/gi, inputs.goal);
    }
    
    // Language
    if (inputs.language) {
      replaced = replaced.replace(/\[LANGUAGE\]/gi, inputs.language);
    }
    
    // Tone
    if (inputs.tone && Array.isArray(inputs.tone) && inputs.tone.length > 0) {
      const toneStr = inputs.tone.join(', ');
      replaced = replaced.replace(/\[TONE\]/gi, toneStr);
    }
    
    // Brand name
    if (inputs.brandCreator?.brandName) {
      replaced = replaced.replace(/\[BRAND NAME\]/gi, inputs.brandCreator.brandName);
      replaced = replaced.replace(/\[BRAND_NAME\]/gi, inputs.brandCreator.brandName);
      replaced = replaced.replace(/\[BRAND\]/gi, inputs.brandCreator.brandName);
    }
    
    // Story fields
    if (inputs.subject?.story) {
      if (inputs.subject.story.characters && inputs.subject.story.characters.length > 0) {
        const charactersStr = inputs.subject.story.characters.join(', ');
        replaced = replaced.replace(/\[CHARACTERS\]/gi, charactersStr);
      }
      if (inputs.subject.story.setting) {
        replaced = replaced.replace(/\[SETTING\]/gi, inputs.subject.story.setting);
      }
      if (inputs.subject.story.theme) {
        replaced = replaced.replace(/\[THEME\]/gi, inputs.subject.story.theme);
      }
      if (inputs.subject.story.conflict) {
        replaced = replaced.replace(/\[CONFLICT\]/gi, inputs.subject.story.conflict);
      }
    }
    
    return replaced;
  };

  // Build comprehensive scene prompt from all scene fields
  const buildComprehensiveScenePrompt = (scene: any): string => {
    // Get inputs from generationContext - try multiple paths
    let inputs = scene.generationContext?.inputs;
    if (!inputs && result.scenes && result.scenes.length > 0) {
      inputs = result.scenes[0]?.generationContext?.inputs;
    }
    // Debug: log inputs to see structure
    if (!inputs) {
      console.warn('No inputs found in generationContext for placeholder replacement');
    } else {
      console.log('Inputs for replacement:', JSON.stringify(inputs, null, 2));
    }
    
    const parts: string[] = [];
    
    // Add Image Prompt if exists (with placeholder replacement)
    if (scene.imagePrompt) {
      const imagePrompt = replacePlaceholders(scene.imagePrompt, inputs);
      parts.push(`Image Prompt: ${imagePrompt}`);
    }
    
    // Add Negative Prompt if exists (with placeholder replacement)
    if (scene.negativePrompt) {
      const negativePrompt = replacePlaceholders(scene.negativePrompt, inputs);
      parts.push(`Negative Prompt: ${negativePrompt}`);
    }
    
    // Add Camera information (with placeholder replacement)
    if (scene.camera) {
      if (typeof scene.camera === 'string') {
        const camera = replacePlaceholders(scene.camera, inputs);
        parts.push(`Camera: ${camera}`);
      } else {
        const cameraParts: string[] = [];
        if (scene.camera.shot) cameraParts.push(replacePlaceholders(scene.camera.shot, inputs));
        if (scene.camera.lens) cameraParts.push(replacePlaceholders(scene.camera.lens, inputs));
        if (scene.camera.movement) cameraParts.push(replacePlaceholders(scene.camera.movement, inputs));
        if (cameraParts.length > 0) {
          parts.push(`Camera: ${cameraParts.join(', ')}`);
        }
      }
    }
    
    // Add Environment information (with placeholder replacement)
    if (scene.environment) {
      if (typeof scene.environment === 'string') {
        const environment = replacePlaceholders(scene.environment, inputs);
        parts.push(`Environment: ${environment}`);
      } else {
        const envParts: string[] = [];
        if (scene.environment.location) envParts.push(replacePlaceholders(scene.environment.location, inputs));
        if (scene.environment.timeOfDay) envParts.push(replacePlaceholders(scene.environment.timeOfDay, inputs));
        if (scene.environment.lighting) envParts.push(replacePlaceholders(scene.environment.lighting, inputs));
        if (envParts.length > 0) {
          parts.push(`Environment: ${envParts.join(', ')}`);
        }
      }
    }
    
    // Add On-screen Text (with placeholder replacement)
    if (scene.onScreenText) {
      if (typeof scene.onScreenText === 'string') {
        const onScreenText = replacePlaceholders(scene.onScreenText, inputs);
        parts.push(`On-screen Text: ${onScreenText}`);
      } else {
        const textParts: string[] = [];
        if (scene.onScreenText.text) textParts.push(replacePlaceholders(scene.onScreenText.text, inputs));
        if (scene.onScreenText.styleNotes) textParts.push(`(${replacePlaceholders(scene.onScreenText.styleNotes, inputs)})`);
        if (textParts.length > 0) {
          parts.push(`On-screen Text: ${textParts.join(' ')}`);
        }
      }
    }
    
    // Add Composition Notes (with placeholder replacement)
    if (scene.compositionNotes) {
      const compositionNotes = replacePlaceholders(scene.compositionNotes, inputs);
      parts.push(`Composition Notes: ${compositionNotes}`);
    }
    
    // Add any other fields dynamically (excluding known fields and metadata)
    const knownFields = ['id', 'index', 'purpose', 'imagePrompt', 'negativePrompt', 'camera', 'environment', 'onScreenText', 'compositionNotes', 'agentContributions', 'finalAssembler', 'imageUrls', 'generationContext', 'shotType', 'notes', 'durationSeconds'];
    for (const [key, value] of Object.entries(scene)) {
      if (!knownFields.includes(key) && value !== null && value !== undefined && value !== '') {
        // Format the field name (convert camelCase to Title Case)
        const fieldName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For objects, stringify them nicely with placeholder replacement
          const objStr = Object.entries(value)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
              const valStr = typeof v === 'string' ? replacePlaceholders(v, inputs) : String(v);
              return `${k}: ${valStr}`;
            })
            .join(', ');
          if (objStr) {
            parts.push(`${fieldName}: ${objStr}`);
          }
        } else if (typeof value === 'string') {
          const replacedValue = replacePlaceholders(value, inputs);
          parts.push(`${fieldName}: ${replacedValue}`);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          parts.push(`${fieldName}: ${value}`);
        }
      }
    }
    
    return parts.join('\n\n');
  };

  const handleGenerateImages = async (referenceImages: File[], model: string, numImages: number, aspectRatio: string, size: string) => {
    setShowImageDialog(false);
    setGeneratingImages(true);

    try {
      // Upload reference images
      const referenceImageUrls = await Promise.all(
        referenceImages.map(file => uploadImageToServer(file))
      );

      // Check if projectId is available (required for background generation)
      if (!result.projectId) {
        alert('Project ID is missing. Cannot start background image generation.');
        setGeneratingImages(false);
        return;
      }

      // Start background image generation
      const response = await fetch('/api/generate-all-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: result.projectId,
          scenes: result.scenes,
          referenceImageUrls: referenceImageUrls,
          model,
          numImages,
          aspectRatio,
          size,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start image generation');
      }

      const data = await response.json();
      
      // Show success message
      alert(
        'Image generation started in the background!\n\n' +
        'Images will be generated and saved automatically even if you close this page.\n' +
        'You can refresh the page later to see the generated images.'
      );

      // Mark that background generation has started
      setBackgroundGenerationStarted(true);
      setGeneratingImages(false);
      
    } catch (error) {
      console.error('Error starting image generation:', error);
      alert(
        error instanceof Error 
          ? `Failed to start image generation: ${error.message}`
          : 'Failed to start image generation. Please try again.'
      );
      setGeneratingImages(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {backgroundGenerationStarted && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin mt-0.5"></div>
            <div className="flex-1">
              <p className="text-sm sm:text-base text-white font-medium">
                Images are being generated in the background
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Images will be saved automatically even if you close this page. 
                New images will appear automatically, or you can refresh the page to see updates.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-black rounded-xl p-4 sm:p-6 shadow-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">Generated Scenes</h2>
          <button
            onClick={() => setShowImageDialog(true)}
            className="px-4 py-2 bg-[#D1FE17] text-black rounded-lg hover:bg-[#B8E014] active:bg-[#9FC211] transition-all duration-200 text-sm font-medium"
          >
            Generate Images
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
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
            
            // Get the first generated image for this scene as cover
            const sceneImages = generatedImages.filter(img => img.sceneIndex === sceneIndex && !img.generating);
            const coverImage = sceneImages.length > 0 ? sceneImages[0].url : null;
            // Fallback to scene.imageUrls if generatedImages doesn't have it yet
            const fallbackCoverImage = scene.imageUrls && scene.imageUrls.length > 0 ? scene.imageUrls[0] : null;
            const displayImage = coverImage || fallbackCoverImage;

            return (
              <div 
                key={sceneIndex} 
                className="border border-gray-800 rounded-lg overflow-hidden transition-all hover:shadow-md bg-black flex flex-col"
              >
                {/* Image Cover */}
                <div 
                  className="relative w-full aspect-[9/16] bg-gray-100 cursor-pointer group"
                  onClick={() => {
                    if (displayImage) {
                      setSelectedImage({ sceneIndex, url: displayImage, generating: false });
                    } else {
                      toggleScene(sceneIndex);
                    }
                  }}
                >
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt={`Scene ${sceneIndex}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                          {sceneImages.length > 1 && (
                            <span className="bg-black bg-opacity-60 px-1.5 py-0.5 rounded text-xs">
                              {sceneImages.length} images
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <div className="text-center p-2">
                        <svg
                          className="w-8 h-8 mx-auto text-gray-400 mb-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-[10px] text-gray-500">No image</p>
                      </div>
                    </div>
                  )}
                  {/* Scene number badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className="bg-black bg-opacity-60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {sceneIndex}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-white mb-0.5 truncate">Scene {sceneIndex}</h3>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                        {imagePrompt || 'No prompt available'}
                      </p>
                    </div>
                    {/* Info icon */}
                    {(scene.generationContext || scene.agentContributions) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScene(sceneIndex);
                        }}
                        className="p-0.5 text-gray-400 hover:text-[#D1FE17] hover:bg-[#D1FE17]/20 rounded transition-colors flex-shrink-0 ml-1"
                        title="View generation breakdown"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
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

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="mt-1 pt-1 border-t border-gray-800 space-y-1.5">
                      {imagePrompt && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">Image Prompt:</p>
                          <p className="text-[10px] text-gray-400">{imagePrompt}</p>
                        </div>
                      )}
                      {scene.negativePrompt && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">Negative Prompt:</p>
                          <p className="text-[10px] text-gray-400">{scene.negativePrompt}</p>
                        </div>
                      )}
                      {cameraText && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">Camera:</p>
                          <p className="text-[10px] text-gray-400">{cameraText}</p>
                        </div>
                      )}
                      {scene.environment && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">Environment:</p>
                          <p className="text-[10px] text-gray-400">
                            {[
                              scene.environment.location,
                              scene.environment.timeOfDay,
                              scene.environment.lighting
                            ].filter(Boolean).join(', ') || 'Not specified'}
                          </p>
                        </div>
                      )}
                      {onScreenTextValue && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">On-screen Text:</p>
                          <p className="text-[10px] text-gray-400">
                            {onScreenTextValue}
                            {typeof scene.onScreenText === 'object' && scene.onScreenText?.styleNotes && (
                              <span className="text-gray-500 ml-1">({scene.onScreenText.styleNotes})</span>
                            )}
                          </p>
                        </div>
                      )}
                      {(scene.compositionNotes || scene.notes) && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-300 mb-0.5">Notes:</p>
                          <p className="text-[10px] text-gray-500 italic">{scene.compositionNotes || scene.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleScene(sceneIndex);
                    }}
                    className="mt-1 text-[10px] text-[#D1FE17] hover:text-[#B8E014] font-medium flex items-center gap-0.5"
                  >
                    {isExpanded ? 'Less' : 'Details'}
                    <svg
                      className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {generatedImages.length > 0 && (
        <ImageCarousel
          images={generatedImages}
          onImageClick={setSelectedImage}
          onSkip={(image) => {
            // Find and abort the request for this image
            const requestKey = `${image.sceneIndex}-${image.imageIndex ?? 0}`;
            const abortController = activeRequestsRef.current.get(requestKey);
            if (abortController) {
              abortController.abort();
              activeRequestsRef.current.delete(requestKey);
            }
            // Remove the generating placeholder
            setGeneratedImages(prev =>
              prev.filter(img => !(
                img.sceneIndex === image.sceneIndex && 
                img.generating && 
                (img.imageIndex ?? 0) === (image.imageIndex ?? 0)
              ))
            );
          }}
        />
      )}


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

