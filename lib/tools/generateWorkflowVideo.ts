import { generateGrokImagineVideo } from './grokImagineVideo';
import { generateVideo as generateSeedanceVideo } from './seedanceVideo';
import {
  getVideoModel,
  type VideoModelId,
} from './videoModels';

export interface GenerateWorkflowVideoOptions {
  model?: VideoModelId | string;
  prompt: string;
  referenceImages: string[];
  duration?: number;
  resolution?: '720p' | '480p';
  aspectRatio?: string;
  generateAudio?: boolean;
}

/**
 * Route video generation to the selected model.
 * Seedance: multi reference_images. Grok Imagine: first image as starting frame.
 */
export async function generateWorkflowVideo(
  options: GenerateWorkflowVideoOptions
): Promise<{ videoUrl: string; modelId: VideoModelId }> {
  const model = getVideoModel(options.model);
  const refs = options.referenceImages.filter(Boolean);

  if (model.imageMode === 'image') {
    const videoUrl = await generateGrokImagineVideo({
      prompt: options.prompt,
      image: refs[0],
      duration: options.duration,
      resolution: options.resolution,
      aspectRatio: options.aspectRatio,
    });
    return { videoUrl, modelId: model.id };
  }

  const videoUrl = await generateSeedanceVideo({
    prompt: options.prompt,
    referenceImages: refs,
    duration: options.duration,
    resolution: options.resolution,
    aspectRatio: options.aspectRatio,
    generateAudio: options.generateAudio ?? true,
  });
  return { videoUrl, modelId: model.id };
}
