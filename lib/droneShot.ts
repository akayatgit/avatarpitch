import { z } from 'zod';

export const DRONE_SHOT_FORMAT = 'drone_shot_v1' as const;

const FootageSuggestionSchema = z.object({
  title: z.string(),
  concept: z.string(),
  scale: z.enum(['microscopic', 'gigantic']),
  imagePrompt: z.string(),
  motionHint: z.string(),
  inspirationRead: z.string().optional(),
});

const DroneShotIdeationSchema = z.object({
  inspirationImageUrl: z.string(),
  topic: z.string(),
  suggestion: FootageSuggestionSchema,
  inspirationRead: z.string().nullable(),
  draftImageUrl: z.string(),
  finalImageUrl: z.string(),
  corrections: z.string(),
});

export type DroneShotIdeation = z.infer<typeof DroneShotIdeationSchema>;

/** Full persisted state of a drone shot project (stored in content_creation_requests.generated_output). */
export const DroneShotStateSchema = z.object({
  format: z.literal(DRONE_SHOT_FORMAT),
  // 'image' is the current first step; 'ideation'/'world' are legacy steps kept for old saved projects.
  step: z.enum(['image', 'ideation', 'world', 'draw', 'prompt', 'video']),
  /** Legacy surreal-concept ideation — no longer produced, kept so old projects still parse. */
  ideation: DroneShotIdeationSchema.nullable(),
  /** The resolved Pinterest / uploaded photo used directly as the world still. */
  inspirationImageUrl: z.string().nullable().default(null),
  duration: z.number(),
  resolution: z.enum(['720p', '480p']),
  imageModel: z.enum(['nano-banana-2', 'seedream-3']),
  videoModel: z.enum(['seedance-2', 'grok-imagine-1.5']),
  referenceSource: z.enum(['path', 'original']),
  aerialImageUrl: z.string().nullable(),
  /** Annotated world still with the drawn flight path (data URL or storage URL). */
  annotatedImage: z.string().nullable(),
  prompt: z.string(),
  pathAnalysis: z.string().nullable(),
  videoUrl: z.string().nullable(),
});

export type DroneShotState = z.infer<typeof DroneShotStateSchema>;
