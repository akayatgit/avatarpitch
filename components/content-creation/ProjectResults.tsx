'use client';

import { useState, useEffect, useRef } from 'react';
import AgentBreakdownDialog from './AgentBreakdownDialog';
import GenerationBreakdownDialog from './GenerationBreakdownDialog';
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
    status?: 'processing' | 'completed' | 'failed'; // Project status
  };
  onStartNew: () => void;
}

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  generating?: boolean;
  imageIndex?: number;
}

interface GeneratedVideo {
  id: string;
  url: string;
  imageUrls: string[];
  generating?: boolean;
  createdAt: Date;
}

export default function ProjectResults({ result: initialResult, onStartNew }: ProjectResultsProps) {
  const [downloading, setDownloading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [backgroundGenerationStarted, setBackgroundGenerationStarted] = useState(false);
  const [result, setResult] = useState(initialResult);
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<number>>(new Set());
  const activeRequestsRef = useRef<Map<string, AbortController>>(new Map());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update result when initialResult changes
  useEffect(() => {
    setResult(initialResult);
  }, [initialResult]);

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

  // Set up polling to check for updates (scenes and images) if projectId exists
  // This handles both prompt generation and image generation in progress
  useEffect(() => {
    if (result.projectId) {
      // Check if we're in processing state (scenes not yet generated)
      const isProcessing = (result as any).status === 'processing' || result.scenes.length === 0;
      
      // Check if images are already being generated (if any scenes have imageUrls)
      const hasImages = result.scenes.some((scene: any) => scene.imageUrls && scene.imageUrls.length > 0);
      
      // If processing or no images yet, assume generation might be in progress and start polling
      if (isProcessing || hasImages || result.scenes.length === 0) {
        setBackgroundGenerationStarted(true);
      }
      
      // Poll every 3 seconds to check for updates (scenes and images)
      refreshIntervalRef.current = setInterval(async () => {
        try {
          // Fetch updated project data
          const response = await fetch(`/api/project/${result.projectId}`);
          if (response.ok) {
            const data = await response.json();
            const scenes = data.scenes || [];
            const status = data.status || 'pending';
            
            // Always update status, even if scenes array is empty (generation in progress)
            if (status !== result.status) {
              setResult(prev => ({
                ...prev,
                status: status as any,
              }));
            }

            // Update image generation settings if available
            if (data.imageGenerationSettings && !imageGenerationSettings) {
              setImageGenerationSettings(data.imageGenerationSettings);
            }
            
            // Update scenes if we have any
            if (scenes.length > 0) {
              // Update result with new scenes data
              const updatedImages: GeneratedImage[] = scenes.flatMap((scene: any, idx: number) => {
                const sceneIndex = scene.index ?? (idx + 1);
                return (scene.imageUrls || []).map((url: string, imgIdx: number) => ({
                  sceneIndex,
                  url,
                  generating: false,
                  imageIndex: imgIdx,
                }));
              });
              
              // Check if all scenes have at least one image
              const allScenesHaveImages = scenes.every((scene: any) => 
                scene.imageUrls && scene.imageUrls.length > 0
              );
              
              // Update images if we have any (even if count is same, URLs might have changed)
              setGeneratedImages(prev => {
                // Check if we have new images by comparing URLs
                const prevUrls = new Set(prev.map(img => img.url));
                const updatedUrls = new Set(updatedImages.map(img => img.url));
                
                // Check if there are new URLs or if the count changed
                const hasNewUrls = updatedImages.some(img => !prevUrls.has(img.url));
                const countChanged = prev.length !== updatedImages.length;
                
                // Always update if we have new images or count changed
                if (updatedImages.length > 0 && (hasNewUrls || countChanged || JSON.stringify(updatedImages) !== JSON.stringify(prev))) {
                  return updatedImages;
                }
                return prev;
              });
              
              // Update result with new scenes if we got them (show scenes as they appear)
              // Check if scenes have changed by comparing scene counts and image URLs
              const scenesChanged = scenes.length !== result.scenes.length;
              const imagesChanged = scenes.some((scene: any, idx: number) => {
                const sceneIndex = scene.index ?? (idx + 1);
                const prevScene = result.scenes.find((s: any) => (s.index ?? result.scenes.indexOf(s) + 1) === sceneIndex);
                if (!prevScene) return true; // New scene
                const prevUrls = new Set(prevScene.imageUrls || []);
                const newUrls = new Set(scene.imageUrls || []);
                // Check if URLs changed (new URLs added or count changed)
                return newUrls.size !== prevUrls.size || Array.from(newUrls).some(url => !prevUrls.has(url));
              });
              
              if (scenesChanged || imagesChanged || JSON.stringify(scenes) !== JSON.stringify(result.scenes)) {
                // Update the result state with new scenes
                setResult(prev => ({
                  ...prev,
                  scenes: scenes,
                  status: status as any,
                }));
              }
              
              // If all scenes have at least one image and status is completed, consider generation complete
              if (allScenesHaveImages && scenes.length > 0 && status === 'completed') {
                setBackgroundGenerationStarted(false);
                // Clear the interval since generation is complete
                if (refreshIntervalRef.current) {
                  clearInterval(refreshIntervalRef.current);
                  refreshIntervalRef.current = null;
                }
              } else if (updatedImages.length > 0 || status === 'pending') {
                // If we have images but not all scenes have them yet, or status is pending, keep showing the message
                setBackgroundGenerationStarted(true);
              }
            } else if (status === 'pending') {
              // If no scenes yet but status indicates pending (generation in progress), keep polling
              setBackgroundGenerationStarted(true);
            } else if (status === 'failed') {
              // If status is failed, stop polling
              setBackgroundGenerationStarted(false);
              if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
              }
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Clean up interval on unmount
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval if no projectId
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [result.projectId, result.scenes]);

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

  // Helper function to create consistent image IDs
  const getImageId = (image: GeneratedImage, index: number): string => {
    return `${image.sceneIndex}-${image.imageIndex ?? index}`;
  };

  const handleImageSelect = (imageId: string, selected: boolean) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(imageId);
      } else {
        newSet.delete(imageId);
      }
      return newSet;
    });
  };

  const handleGenerateVideo = async () => {
    if (selectedImageIds.size === 0) return;

    setGeneratingVideo(true);
    
    try {
      // Get the selected images - need to match IDs using the same format as ImageCarousel
      // We need to use the original indices from generatedImages array
      const selectedImages = generatedImages
        .map((img, originalIdx) => ({
          image: img,
          originalIdx,
          imageId: getImageId(img, originalIdx),
        }))
        .filter(({ imageId, image }) => selectedImageIds.has(imageId) && !image.generating)
        .map(({ image }) => image);

      if (selectedImages.length === 0) {
        alert('Please select at least one valid image');
        setGeneratingVideo(false);
        return;
      }

      // Generate a video for each selected image
      const videoPromises = selectedImages.map(async (image, index) => {
        // Create a unique video ID for each image
        const videoId = `video-${Date.now()}-${index}`;
        
        // Create a new video entry with generating state
        const newVideo: GeneratedVideo = {
          id: videoId,
          url: '',
          imageUrls: [image.url], // Each video uses a single image
          generating: true,
          createdAt: new Date(),
        };

        // Add video to the list immediately
        setGeneratedVideos(prev => [...prev, newVideo]);

        try {
          // Call the API to generate video for this image
          const response = await fetch('/api/generate-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrls: [image.url], // Send single image URL
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate video');
          }

          const data = await response.json();
          
          // Update the video with the generated URL
          setGeneratedVideos(prev => prev.map(video => 
            video.id === videoId 
              ? { ...video, url: data.videoUrl, generating: false }
              : video
          ));

          return { success: true, videoId };
        } catch (error) {
          console.error(`Error generating video for image ${index + 1}:`, error);
          
          // Remove the failed video entry
          setGeneratedVideos(prev => prev.filter(video => video.id !== videoId));
          
          return { success: false, videoId, error };
        }
      });

      // Wait for all videos to be generated
      const results = await Promise.allSettled(videoPromises);
      
      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      if (successful > 0) {
        if (failed > 0) {
          alert(`Generated ${successful} video(s) successfully. ${failed} video(s) failed.`);
        } else {
          // All videos generated successfully
          console.log(`Successfully generated ${successful} video(s)`);
        }
      } else {
        alert('Failed to generate videos. Please try again.');
      }

      // Clear selected images after generation completes
      setSelectedImageIds(new Set());
    } catch (error) {
      console.error('Error in video generation:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate videos');
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleDownloadVideo = async (video: GeneratedVideo) => {
    if (!video.url || video.generating) return;

    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('Failed to download video');
    }
  };

  // Extract image generation settings from project data or use defaults
  const [imageGenerationSettings, setImageGenerationSettings] = useState<{
    referenceImageUrls: string[];
    model: string;
    numImages: number;
    aspectRatio: string;
    size: string;
  } | null>(null);

  // Fetch image generation settings from project API
  useEffect(() => {
    if (result.projectId) {
      fetch(`/api/project/${result.projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data.imageGenerationSettings) {
            setImageGenerationSettings(data.imageGenerationSettings);
          }
        })
        .catch(err => {
          console.error('Error fetching image generation settings:', err);
        });
    }
  }, [result.projectId]);

  const getImageGenerationSettings = () => {
    // Use stored settings if available, otherwise use defaults
    if (imageGenerationSettings) {
      return imageGenerationSettings;
    }

    // Default settings
    return {
      referenceImageUrls: [],
      model: 'seedream-4.5',
      numImages: 1,
      aspectRatio: '9:16',
      size: '4K',
    };
  };

  const handleRegenerateAllImages = async () => {
    if (!result.projectId) {
      alert('Project ID is required for regeneration');
      return;
    }

    const settings = getImageGenerationSettings();
    
    // Check if we have reference image URLs - if not, prompt the user
    if (!settings.referenceImageUrls || settings.referenceImageUrls.length === 0) {
      const userInput = prompt(
        'Reference image URLs are required for regeneration.\n\n' +
        'Please provide reference image URLs (comma-separated):'
      );
      
      if (!userInput || userInput.trim() === '') {
        alert('Reference image URLs are required for regeneration');
        return;
      }
      
      settings.referenceImageUrls = userInput.split(',').map(url => url.trim()).filter(Boolean);
    }

    setRegeneratingAll(true);

    try {
      const response = await fetch('/api/regenerate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: result.projectId,
          ...settings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate images');
      }

      // Clear existing images from UI immediately
      setGeneratedImages([]);
      
      // Restart polling to check for new images
      setBackgroundGenerationStarted(true);

      alert('Image regeneration started! Images will appear as they are generated.');
    } catch (error) {
      console.error('Error regenerating images:', error);
      alert(error instanceof Error ? error.message : 'Failed to regenerate images');
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleRegenerateScene = async (sceneIndex: number) => {
    if (!result.projectId) {
      alert('Project ID is required for regeneration');
      return;
    }

    const settings = getImageGenerationSettings();
    
    // Check if we have reference image URLs
    if (!settings.referenceImageUrls || settings.referenceImageUrls.length === 0) {
      const userInput = prompt(
        'Reference image URLs are required for regeneration.\n\n' +
        'Please provide reference image URLs (comma-separated):'
      );
      
      if (!userInput || userInput.trim() === '') {
        alert('Reference image URLs are required for regeneration');
        return;
      }
      
      settings.referenceImageUrls = userInput.split(',').map(url => url.trim()).filter(Boolean);
    }

    setRegeneratingScenes(prev => new Set(prev).add(sceneIndex));

    try {
      const response = await fetch('/api/regenerate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: result.projectId,
          sceneIndex,
          ...settings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate scene image');
      }

      // Clear existing images for this scene from UI
      setGeneratedImages(prev => prev.filter(img => img.sceneIndex !== sceneIndex));
      
      // Restart polling to check for new images
      setBackgroundGenerationStarted(true);

      // Show a brief success message
      console.log(`Scene ${sceneIndex} regeneration started`);
    } catch (error) {
      console.error('Error regenerating scene:', error);
      alert(error instanceof Error ? error.message : 'Failed to regenerate scene image');
    } finally {
      setRegeneratingScenes(prev => {
        const newSet = new Set(prev);
        newSet.delete(sceneIndex);
        return newSet;
      });
    }
  };

  const handleShowImageUrl = async (sceneIndex: number) => {
    if (!result.projectId) {
      alert('Project ID is required');
      return;
    }

    try {
      const response = await fetch(`/api/project/${result.projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project data');
      }
      
      const data = await response.json();
      const scenes = data.scenes || [];
      const scene = scenes.find((s: any, idx: number) => {
        const currentSceneIndex = s.index ?? (idx + 1);
        return currentSceneIndex === sceneIndex;
      });

      if (scene) {
        const imageUrls = scene.imageUrls || [];
        const sceneImages = generatedImages.filter(img => img.sceneIndex === sceneIndex);
        
        const info = {
          sceneIndex,
          sceneIndexInArray: scenes.indexOf(scene),
          sceneHasIndex: scene.index !== undefined,
          imageUrlsInDatabase: imageUrls,
          imageUrlsInState: sceneImages.map(img => img.url),
          imageUrlsCount: imageUrls.length,
          stateImagesCount: sceneImages.length,
        };

        console.log(`Scene ${sceneIndex} Image URLs:`, info);
        
        const message = `Scene ${sceneIndex} Image URLs:\n\n` +
          `Database (imageUrls): ${imageUrls.length > 0 ? imageUrls.join(', ') : 'NONE'}\n` +
          `State (generatedImages): ${sceneImages.length > 0 ? sceneImages.map(img => img.url).join(', ') : 'NONE'}\n\n` +
          `Full debug info logged to console.`;
        
        alert(message);
      } else {
        alert(`Scene ${sceneIndex} not found in database`);
      }
    } catch (error) {
      console.error('Error fetching image URL:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch image URL');
    }
  };

  const handleFetchImage = async (sceneIndex: number) => {
    if (!result.projectId) {
      alert('Project ID is required');
      return;
    }

    try {
      // Fetch latest project data
      const response = await fetch(`/api/project/${result.projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project data');
      }
      
      const data = await response.json();
      const scenes = data.scenes || [];
      const scene = scenes.find((s: any, idx: number) => {
        const currentSceneIndex = s.index ?? (idx + 1);
        return currentSceneIndex === sceneIndex;
      });

      if (scene && scene.imageUrls && scene.imageUrls.length > 0) {
        // Update the generatedImages state with images from database
        const updatedImages: GeneratedImage[] = scene.imageUrls.map((url: string, imgIdx: number) => ({
          sceneIndex,
          url,
          generating: false,
          imageIndex: imgIdx,
        }));

        setGeneratedImages(prev => {
          // Remove old images for this scene
          const filtered = prev.filter(img => img.sceneIndex !== sceneIndex);
          // Add new images
          return [...filtered, ...updatedImages];
        });

        // Also update the result state
        setResult(prev => ({
          ...prev,
          scenes: prev.scenes.map((s: any, idx: number) => {
            const currentSceneIndex = s.index ?? (idx + 1);
            if (currentSceneIndex === sceneIndex) {
              return {
                ...s,
                imageUrls: scene.imageUrls,
              };
            }
            return s;
          }),
        }));

        alert(`Fetched ${scene.imageUrls.length} image(s) for scene ${sceneIndex}`);
      } else {
        alert(`No images found in database for scene ${sceneIndex}`);
      }
    } catch (error) {
      console.error('Error fetching image:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch image');
    }
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


  // Check if we're still processing (scenes not yet generated)
  // Status can be 'pending' or we check if scenes are empty
  const isProcessing = (result as any).status === 'pending' || result.scenes.length === 0;
  
  // Check if all scenes have at least one image
  const allScenesHaveImages = result.scenes.length > 0 && result.scenes.every((scene: any) => 
    scene.imageUrls && scene.imageUrls.length > 0
  );
  
  // Only show background generation message if images are being generated AND not all scenes have images yet
  const showImageGenerationMessage = backgroundGenerationStarted && !isProcessing && !allScenesHaveImages;

  return (
    <div className="space-y-4 sm:space-y-6">
      {isProcessing && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin mt-0.5"></div>
            <div className="flex-1">
              <p className="text-sm sm:text-base text-white font-medium">
                Generating prompts and scenes...
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                You can close this page and come back later. Generation will continue in the background.
                Scenes will appear automatically when ready.
              </p>
            </div>
          </div>
        </div>
      )}
      {showImageGenerationMessage && (
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
          {result.projectId && result.scenes.length > 0 && !isProcessing && (
            <button
              onClick={handleRegenerateAllImages}
              disabled={regeneratingAll}
              className="px-3 py-1.5 bg-[#D1FE17] text-black text-xs font-medium rounded-lg hover:bg-[#B8E014] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              title="Regenerate all images for all scenes"
            >
              {regeneratingAll ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Regenerate All Images
                </>
              )}
            </button>
          )}
        </div>
        {isProcessing && result.scenes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Generating scenes... This may take a few minutes.</p>
            <p className="text-sm text-gray-500 mt-2">You can close this page and check back later.</p>
          </div>
        ) : (
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
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-[10px] text-gray-400">Generating...</p>
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
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                      {/* Debug: Show URL button */}
                      {result.projectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowImageUrl(sceneIndex);
                          }}
                          className="p-0.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                          title="Show image URL from database"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        </button>
                      )}
                      {/* Debug: Fetch Image button */}
                      {result.projectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFetchImage(sceneIndex);
                          }}
                          className="p-0.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors"
                          title="Manually fetch image from database"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                        </button>
                      )}
                      {/* Regenerate button for this scene */}
                      {result.projectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateScene(sceneIndex);
                          }}
                          disabled={regeneratingScenes.has(sceneIndex)}
                          className="p-0.5 text-gray-400 hover:text-[#D1FE17] hover:bg-[#D1FE17]/20 rounded transition-colors"
                          title="Regenerate images for this scene"
                        >
                          {regeneratingScenes.has(sceneIndex) ? (
                            <div className="w-3 h-3 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                      {/* Info icon */}
                      {(scene.generationContext || scene.agentContributions) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScene(sceneIndex);
                          }}
                          className="p-0.5 text-gray-400 hover:text-[#D1FE17] hover:bg-[#D1FE17]/20 rounded transition-colors"
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
        )}
      </div>

      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <ImageCarousel
            images={generatedImages}
            onImageClick={setSelectedImage}
            selectedImages={selectedImageIds}
            onImageSelect={handleImageSelect}
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
          
          {selectedImageIds.size > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white">
                  {selectedImageIds.size} image{selectedImageIds.size > 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                  className="px-4 py-2 bg-[#D1FE17] text-black font-medium rounded-lg hover:bg-[#B8E014] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {generatingVideo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Video'
                  )}
                </button>
              </div>
            </div>
          )}

          {generatedVideos.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-800">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Generated Videos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="border border-gray-800 rounded-lg overflow-hidden bg-black"
                  >
                    {video.generating ? (
                      <div className="w-full aspect-[9/16] bg-gray-800 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs text-gray-400">Generating video...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <video
                          src={video.url}
                          className="w-full aspect-[9/16] object-cover"
                          controls
                        />
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                              {video.imageUrls.length} image{video.imageUrls.length > 1 ? 's' : ''}
                            </p>
                            <button
                              onClick={() => handleDownloadVideo(video)}
                              className="px-3 py-1.5 bg-[#D1FE17] text-black text-xs font-medium rounded hover:bg-[#B8E014] transition-colors flex items-center gap-1.5"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              Download
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      {/* Image Viewer */}
      <ImageViewer
        image={selectedImage}
        images={generatedImages.filter(img => !img.generating)}
        onClose={() => setSelectedImage(null)}
        onNavigate={setSelectedImage}
      />
    </div>
  );
}

