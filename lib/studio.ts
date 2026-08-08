import { z } from 'zod';

export const STUDIO_FORMAT = 'studio_v1' as const;

export const ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;
export type StudioAspectRatio = (typeof ASPECT_RATIOS)[number];

export const VIDEO_MODELS = ['seedance-1-pro-fast', 'veo-3.1'] as const;
export type StudioVideoModel = (typeof VIDEO_MODELS)[number];

/** Shape of a single scene inside a studio project. */
export const StudioSceneSchema = z.object({
  id: z.string(),
  summary: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  dialogue: z.string().nullable(),
  videoModel: z.enum(VIDEO_MODELS),
  /** Scene first-frame image (reference image + scene prompt), used as video input. */
  frameUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
});

export type StudioScene = z.infer<typeof StudioSceneSchema>;

/** Full persisted state of a studio project (stored in content_creation_requests.generated_output). */
export const StudioStateSchema = z.object({
  format: z.literal(STUDIO_FORMAT),
  title: z.string(),
  script: z.string(),
  aspectRatio: z.enum(ASPECT_RATIOS),
  characterPrompt: z.string(),
  referenceImageUrl: z.string().nullable(),
  referenceImageSource: z.enum(['upload', 'generated']).nullable(),
  scenes: z.array(StudioSceneSchema),
  step: z.number().int().min(1).max(4),
});

export type StudioState = z.infer<typeof StudioStateSchema>;

/** Shape the parse-script LLM call must return (scene ids/videoModel are assigned server-side). */
export const ParsedScriptSchema = z.object({
  title: z.string().min(1),
  characterPrompt: z.string().min(1),
  scenes: z
    .array(
      z.object({
        summary: z.string().min(1),
        imagePrompt: z.string().min(1),
        videoPrompt: z.string().min(1),
        dialogue: z.string().nullable().optional(),
      })
    )
    .min(1)
    .max(8),
});

export type ParsedScript = z.infer<typeof ParsedScriptSchema>;

export function createEmptyStudioState(): StudioState {
  return {
    format: STUDIO_FORMAT,
    title: '',
    script: '',
    aspectRatio: '9:16',
    characterPrompt: '',
    referenceImageUrl: null,
    referenceImageSource: null,
    scenes: [],
    step: 1,
  };
}
