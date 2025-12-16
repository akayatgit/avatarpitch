import { z } from 'zod';

// Agent definition schema (updated to support shared state workflow)
export const AgentDefinitionSchema = z.object({
  id: z.string(),
  role: z.union([
    z.enum([
      'fashion_expert',
      'fabrics_expert',
      'sales_person',
      'trend_identifier',
      'video_director',
      'copywriter',
      'brand_strategist',
      'visual_stylist',
    ]),
    z.string(), // Allow custom roles
  ]),
  name: z.string(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(), // Task-specific prompt
  temperature: z.number().min(0).max(2).optional(),
  order: z.number().int().positive(),
  inputFrom: z.array(z.string()).optional(), // Legacy: agent IDs
  outputTo: z.array(z.string()).optional(), // Legacy: agent IDs
  readsFrom: z.array(z.string()).optional(), // New: shared state keys to read
  writesTo: z.array(z.string()).optional(), // New: shared state keys to write
}).passthrough();

export const AgentWorkflowSchema = z.object({
  agents: z.array(AgentDefinitionSchema),
  executionOrder: z.enum(['sequential', 'parallel', 'custom']),
});

// Template config schema (updated to support agent workflows and image-first generation)
export const TemplateConfigSchema = z.object({
  version: z.number(),
  output: z.object({
    sceneCount: z.number().int().positive(),
    minSceneSeconds: z.number().int().positive().optional(),
    maxSceneSeconds: z.number().int().positive().optional(),
    aspectRatio: z.string(),
    style: z.string(),
    renderTarget: z.enum(['image_first_frame', 'video']).optional().default('video'),
    limits: z.object({
      imagePromptMaxChars: z.number().int().positive(),
      cameraMaxChars: z.number().int().positive(),
      negativesMaxChars: z.number().int().positive(),
      maxSentencesImagePrompt: z.number().int().positive(),
      maxWordsOnScreenText: z.number().int().positive(),
    }).passthrough().optional(),
    cameraPresets: z.array(z.string()).optional(),
  }).passthrough(),
  workflow: z.union([
    // Legacy workflow format – passthrough so we can attach agentWorkflow without losing it
    z
      .object({
        systemPrompt: z.string(),
        sceneBlueprint: z.array(
          z.object({
            type: z.string(),
            goal: z.string(),
          }).passthrough()
        ).optional(),
        shotLibrary: z.array(
          z.object({
            type: z.string(),
            purpose: z.string(),
          })
        ).optional(),
        constraints: z.array(z.string()),
      })
      .passthrough(),

    // New agent-based workflow – sceneBlueprint/shotLibrary / constraints optional
    z
      .object({
        agentWorkflow: AgentWorkflowSchema,
        sceneBlueprint: z
          .array(
            z.object({
              type: z.string(),
              goal: z.string(),
              agentIds: z.array(z.string()).optional(), // Which agents work on this scene
            }).passthrough()
          )
          .optional(),
        shotLibrary: z
          .array(
            z.object({
              type: z.string(),
              purpose: z.string(),
            })
          )
          .optional(),
        constraints: z.array(z.string()).optional(),
        finalAssembly: z
          .object({
            agentId: z.string(), // Agent that assembles final scenes
          })
          .optional(),
      })
      .passthrough(),

    // Agent workflow only (minimal) – also passthrough to avoid stripping other fields
    z
      .object({
        agentWorkflow: AgentWorkflowSchema,
      })
      .passthrough(),
  ]),
}).passthrough();

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AgentWorkflow = z.infer<typeof AgentWorkflowSchema>;

// Scene schema (updated for image-first generation)
export const SceneSchema = z.object({
  index: z.number().int().positive(),
  shotType: z.string(),
  camera: z.string(),
  imagePrompt: z.string(),
  negativePrompt: z.string().optional(),
  onScreenText: z.string().optional(),
  notes: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(), // Optional for image-first
  agentContributions: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    agentRole: z.string(),
    order: z.number(),
    contribution: z.any(),
    writesTo: z.array(z.string()),
  })).optional(),
  finalAssembler: z.object({
    agentId: z.string(),
    agentName: z.string(),
    agentRole: z.string(),
    sharedStateUsed: z.any(),
  }).optional(),
});

// Rendering spec schema (updated for image-first)
export const RenderingSpecSchema = z.object({
  aspectRatio: z.string(),
  style: z.string(),
  imageModelHint: z.string().optional(),
  colorGrade: z.string().optional(),
  lightingMood: z.string().optional(),
  musicMood: z.string().optional(), // Legacy support
  transitions: z.string().optional(), // Legacy support
});

// Generated project output schema (updated for image-first)
export const GeneratedProjectSchema = z.object({
  scenes: z.array(SceneSchema),
  renderingSpec: RenderingSpecSchema,
}).refine(
  (data) => {
    // Validate scene count matches expected (usually 8 for image-first)
    // This will be enforced by the generator
    return data.scenes.length > 0;
  },
  { message: "Scenes array must not be empty" }
).refine(
  (data) => {
    // Scene 1 must be hook
    return data.scenes[0]?.shotType === 'hook';
  },
  { message: "First scene must have shotType 'hook'" }
).refine(
  (data) => {
    // All indices must be unique and sequential
    const indices = data.scenes.map(s => s.index).sort((a, b) => a - b);
    return indices.every((idx, i) => idx === i + 1);
  },
  { message: "Scene indices must be unique and sequential starting from 1" }
);

export type GeneratedProject = z.infer<typeof GeneratedProjectSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type RenderingSpec = z.infer<typeof RenderingSpecSchema>;

// Form input schemas
export const CreateProjectFormSchema = z.object({
  workspaceId: z.string().uuid(),
  productName: z.string().min(1),
  productLink: z.string().url().optional().or(z.literal('')),
  offer: z.string().min(1),
  features: z.array(z.string()).max(5).optional(),
  targetAudience: z.string().optional(),
  platform: z.enum(['TikTok', 'Reels', 'Shorts']),
});

export type CreateProjectFormData = z.infer<typeof CreateProjectFormSchema>;

