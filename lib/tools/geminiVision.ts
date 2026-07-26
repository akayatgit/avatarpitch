import { getReplicateClient, prepareImageInputs } from './replicateClient';

export const VISION_MODEL_ID = 'google/gemini-2.5-flash' as const;

export interface GeminiVisionOptions {
  prompt: string;
  images: string[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Reusable Gemini 2.5 Flash vision tool — path analysis and prompt assembly. */
export async function runGeminiVision(options: GeminiVisionOptions): Promise<string> {
  const {
    prompt,
    images,
    systemInstruction,
    temperature = 0.4,
    maxOutputTokens = 4096,
  } = options;

  if (!images.length) {
    throw new Error('At least one image is required for vision');
  }

  const replicate = getReplicateClient();
  const prepared = prepareImageInputs(images.slice(0, 10));

  const input: Record<string, any> = {
    prompt,
    images: prepared,
    temperature,
    max_output_tokens: maxOutputTokens,
  };
  if (systemInstruction) {
    input.system_instruction = systemInstruction;
  }

  const output: unknown = await replicate.run(VISION_MODEL_ID, { input });
  return Array.isArray(output) ? output.join('') : String(output ?? '');
}

/** Parse model JSON output, tolerating markdown code fences. */
export function parseModelJson<T = Record<string, unknown>>(content: string): T | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
