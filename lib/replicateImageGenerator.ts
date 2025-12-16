interface ModelConfig {
  modelId: string;
  buildInput: (imageUrl: string, referenceImageUrl: string, customPrompt?: string, outfitUrl?: string | null, numImages?: number, aspectRatio?: string, size?: string) => any;
  processOutput: (output: any) => Promise<Array<{ url: string; file?: any }>>;
}

type ImageGenerationModel = 'seedream-4.5' | 'nano-banana-pro' | 'nano-banana';

function parsePrompt(prompt?: string): string | object {
  if (!prompt) return '';
  try {
    return JSON.parse(prompt);
  } catch {
    return prompt;
  }
}

// Helper function to get dimensions from aspect ratio
function getDimensions(aspectRatio: string, size: string): { width: number; height: number } {
  const sizeMultiplier = size === '4K' ? 2 : 1;
  const baseWidth = size === '4K' ? 2048 : 1024;
  const baseHeight = size === '4K' ? 2048 : 1024;
  
  switch (aspectRatio) {
    case '16:9':
      return {
        width: Math.round(baseWidth * sizeMultiplier),
        height: Math.round((baseWidth * 9 / 16) * sizeMultiplier),
      };
    case '1:1':
      return {
        width: Math.round(baseWidth * sizeMultiplier),
        height: Math.round(baseHeight * sizeMultiplier),
      };
    case '9:16':
    default:
      return {
        width: Math.round((baseHeight * 9 / 16) * sizeMultiplier),
        height: Math.round(baseHeight * sizeMultiplier),
      };
  }
}

// Seedream-4.5 model handler
const seedream4Config: ModelConfig = {
  modelId: 'bytedance/seedream-4.5',
  buildInput: (imageUrl: string, referenceImageUrl: string, customPrompt?: string, outfitUrl?: string | null, numImages: number = 1, aspectRatio: string = '9:16', size: string = '4K') => {
    const imageInput = [imageUrl, referenceImageUrl];
    if (outfitUrl) {
      imageInput.push(outfitUrl);
    }
    
    const prompt = parsePrompt(customPrompt);
    const dimensions = getDimensions(aspectRatio, size);
    
    return {
      size: size,
      width: dimensions.width,
      height: dimensions.height,
      prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      max_images: numImages,
      image_input: imageInput,
      aspect_ratio: aspectRatio,
      enhance_prompt: false,
      sequential_image_generation: 'auto',
    };
  },
  processOutput: async (output: any) => {
    const outputArray = Array.isArray(output) ? output : [output];
    const results: Array<{ url: string; file?: any }> = [];

    for (const outputItem of outputArray) {
      let outputUrl: string | null = null;
      let outputFile: any = null;

      if (outputItem && typeof outputItem.url === 'function') {
        const urlResult = outputItem.url();
        outputUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
        outputFile = outputItem;
      } else if (typeof outputItem === 'string') {
        outputUrl = outputItem;
      } else if (outputItem && typeof outputItem === 'object') {
        outputFile = outputItem;
        if (outputItem.url && typeof outputItem.url === 'string') {
          outputUrl = outputItem.url;
        }
      }

      if (outputUrl && typeof outputUrl === 'string') {
        results.push({ url: outputUrl, file: outputFile });
      }
    }

    return results;
  },
};

// Nano-banana-pro model handler
const nanoBananaProConfig: ModelConfig = {
  modelId: 'google/nano-banana-pro',
  buildInput: (imageUrl: string, referenceImageUrl: string, customPrompt?: string, outfitUrl?: string | null, numImages: number = 1, aspectRatio: string = '9:16', size: string = '4K') => {
    const imageInput = [imageUrl, referenceImageUrl];
    if (outfitUrl) {
      imageInput.push(outfitUrl);
    }
    
    const prompt = parsePrompt(customPrompt);
    
    return {
      prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      resolution: size,
      image_input: imageInput,
      aspect_ratio: aspectRatio,
      output_format: 'png',
      safety_filter_level: 'block_only_high',
      num_images: numImages,
    };
  },
  processOutput: async (output: any) => {
    let outputUrl: string | null = null;
    let outputFile: any = null;

    if (output && typeof output.url === 'function') {
      const urlResult = output.url();
      outputUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
      outputFile = output;
    } else if (typeof output === 'string') {
      outputUrl = output;
    } else if (output && typeof output === 'object' && output.url) {
      outputUrl = typeof output.url === 'string' ? output.url : String(output.url);
      outputFile = output;
    }

    if (outputUrl && typeof outputUrl === 'string') {
      return [{ url: outputUrl, file: outputFile }];
    }

    return [];
  },
};

// Nano-banana model handler
const nanoBananaConfig: ModelConfig = {
  modelId: 'google/nano-banana',
  buildInput: (imageUrl: string, referenceImageUrl: string, customPrompt?: string, outfitUrl?: string | null, numImages: number = 1, aspectRatio: string = '9:16', size: string = '4K') => {
    const imageInput = [imageUrl, referenceImageUrl];
    if (outfitUrl) {
      imageInput.push(outfitUrl);
    }
    
    const prompt = parsePrompt(customPrompt);
    
    // For nano-banana, use aspect_ratio if provided, otherwise match input
    const finalAspectRatio = aspectRatio !== 'match_input_image' ? aspectRatio : 'match_input_image';
    
    return {
      prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      image_input: imageInput,
      aspect_ratio: finalAspectRatio,
      output_format: 'jpg',
      num_images: numImages,
    };
  },
  processOutput: async (output: any) => {
    let outputUrl: string | null = null;
    let outputFile: any = null;

    if (output && typeof output.url === 'function') {
      const urlResult = output.url();
      outputUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
      outputFile = output;
    } else if (typeof output === 'string') {
      outputUrl = output;
    } else if (output && typeof output === 'object') {
      outputFile = output;
      if (output.output && typeof output.output === 'string') {
        outputUrl = output.output;
      } else if (output.url && typeof output.url === 'string') {
        outputUrl = output.url;
      }
    }

    if (outputUrl && typeof outputUrl === 'string') {
      return [{ url: outputUrl, file: outputFile }];
    }

    return [];
  },
};

// Model registry
const modelRegistry: Record<ImageGenerationModel, ModelConfig> = {
  'seedream-4.5': seedream4Config,
  'nano-banana-pro': nanoBananaProConfig,
  'nano-banana': nanoBananaConfig,
};

export function getModelConfig(model: ImageGenerationModel): ModelConfig {
  const config = modelRegistry[model];
  if (!config) {
    throw new Error(`Unknown model: ${model}`);
  }
  return config;
}

export type { ImageGenerationModel };

