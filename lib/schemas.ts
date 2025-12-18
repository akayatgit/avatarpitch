import { z } from 'zod';

/**
 * ============================
 * CONTENT TYPE DEFINITION SCHEMAS
 * ============================
 */

// Output Contract Schemas
const RequiredOutputsSchema = z.object({
  scenes: z.literal(true),
  imagePromptPerScene: z.literal(true),
  textOverlaySuggestions: z.boolean(),
  thumbnailPrompt: z.boolean(),
});

const CameraSchema = z.object({
  shot: z.string().optional(),
  lens: z.string().optional(),
  movement: z.string().optional(),
}).optional();

const EnvironmentSchema = z.object({
  location: z.string().optional(),
  timeOfDay: z.string().optional(),
  lighting: z.string().optional(),
}).optional();

const CharacterSchema = z.object({
  role: z.string(),
  wardrobeNotes: z.string().optional(),
});

const OnScreenTextSchema = z.object({
  text: z.string().optional(),
  styleNotes: z.string().optional(),
}).optional();

const SceneSchemaV1 = z.object({
  id: z.string(),
  purpose: z.string(), // decided dynamically by AI
  imagePrompt: z.string(),
  negativePrompt: z.string().optional(),
  camera: CameraSchema,
  environment: EnvironmentSchema,
  characters: z.array(CharacterSchema).optional(),
  props: z.array(z.string()).optional(),
  onScreenText: OnScreenTextSchema,
  compositionNotes: z.string().optional(),
});

const OutputContractSchema = z.object({
  format: z.literal("storyboard_v1"),
  requiredOutputs: RequiredOutputsSchema,
  sceneSchema: z.object({
    id: z.string(),
    purpose: z.string(),
    imagePrompt: z.string(),
    negativePrompt: z.string().optional(),
    camera: CameraSchema,
    environment: EnvironmentSchema,
    characters: z.array(CharacterSchema).optional(),
    props: z.array(z.string()).optional(),
    onScreenText: OnScreenTextSchema,
    compositionNotes: z.string().optional(),
  }),
  globalDefaults: z.object({
    durationPerSceneSeconds: z.number().int().positive(),
    allowedAspectRatios: z.array(z.enum(["9:16", "1:1", "16:9"])),
    defaultAspectRatio: z.enum(["9:16", "1:1", "16:9"]),
    visualStylePreset: z.string(),
    defaultLanguage: z.string(),
  }),
});

// Scene Generation Policy Schema
const SceneGenerationPolicySchema = z.object({
  minScenes: z.number().int().positive(),
  maxScenes: z.number().int().positive(),
  rules: z.object({
    mustStartStrong: z.boolean().optional(),
    mustEndWithClosure: z.boolean().optional(),
    avoidRepetition: z.boolean().optional(),
    platformAwareOrdering: z.boolean().optional(),
  }).optional(),
});

// Inputs Contract Schema
const InputFieldSchema = z.object({
  key: z.string(), // dot-notation allowed
  label: z.string(),
  type: z.enum(["string", "enum", "list", "boolean", "number"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  maxItems: z.number().int().positive().optional(),
  maxLength: z.number().int().positive().optional(),
  helpText: z.string().optional(),
});

const ConditionalLogicSchema = z.object({
  if: z.object({
    field: z.string(),
    equals: z.any(),
  }),
  then: z.object({
    require: z.array(z.string()),
  }),
});

const InputsContractSchema = z.object({
  fields: z.array(InputFieldSchema),
  conditionalLogic: z.array(ConditionalLogicSchema).optional(),
});

// Prompting Schema
const SafetyRulesSchema = z.object({
  banCopyrightedCharacters: z.boolean().optional(),
  banCompetitorBrands: z.boolean().optional(),
  noMedicalClaims: z.boolean().optional(),
}).optional();

// Agent Workflow Schema (for prompting.agentWorkflow)
const AgentWorkflowForPromptingSchema = z.object({
  agents: z.array(z.object({
    id: z.string(),
    role: z.string(),
    name: z.string(),
    systemPrompt: z.string().optional(),
    prompt: z.string().optional(),
    temperature: z.number().optional(),
    order: z.number(),
    inputFrom: z.array(z.string()).optional(),
    outputTo: z.array(z.string()).optional(),
    readsFrom: z.array(z.string()).optional(),
    writesTo: z.array(z.string()).optional(),
  }).passthrough()),
  executionOrder: z.enum(['sequential', 'parallel', 'custom']),
}).optional();

const PromptingSchema = z.object({
  systemPromptTemplate: z.string(),
  agents: z.union([
    z.array(z.string()),
    z.array(z.object({
      id: z.string(),
      role: z.string(),
      name: z.string(),
    }).passthrough())
  ]).optional(),
  agentWorkflow: AgentWorkflowForPromptingSchema,
  safetyRules: SafetyRulesSchema,
}).passthrough();

// Content Type Definition Schema
export const ContentTypeDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(["marketing", "entertainment", "education", "review", "story"]),
  description: z.string().optional(),
  version: z.string(),
  outputContract: OutputContractSchema,
  sceneGenerationPolicy: SceneGenerationPolicySchema,
  inputsContract: InputsContractSchema,
  prompting: PromptingSchema,
});

export type ContentTypeDefinition = z.infer<typeof ContentTypeDefinitionSchema>;
export type SceneSchemaV1Type = z.infer<typeof SceneSchemaV1>;

/**
 * ============================
 * CONTENT CREATION REQUEST SCHEMAS
 * ============================
 */

// Product Schema (for subject.type === "product")
const ProductSchema = z.object({
  category: z.string().optional(),
  material: z.string().optional(),
  fit: z.string().optional(),
  colors: z.array(z.string()).optional(),
  keyPoints: z.array(z.string()).optional(),
}).optional();

// Story Schema (for subject.type === "story")
const StorySchema = z.object({
  characters: z.array(z.string()).optional(),
  setting: z.string().optional(),
  theme: z.string().optional(),
  conflict: z.string().optional(),
}).optional();

// Subject Schema
const SubjectSchema = z.object({
  type: z.enum(["product", "person", "place", "service", "story", "idea"]),
  name: z.string(),
  product: ProductSchema,
  story: StorySchema,
});

// Offer Schema
const OfferSchema = z.object({
  text: z.string().optional(),
}).optional();

// Audience Schema
const AudienceSchema = z.object({
  description: z.string().optional(),
  locale: z.string().optional(),
}).optional();

// Brand/Creator Schema
const BrandCreatorSchema = z.object({
  brandName: z.string().optional(),
  creatorStyle: z.string().optional(),
  visualGuidelines: z.array(z.string()).optional(),
  forbiddenWords: z.array(z.string()).optional(),
  brandSafetyLevel: z.enum(["safe", "edgy", "unrestricted"]).optional(),
}).optional();

// Content Creation Request Inputs Schema
const ContentCreationInputsSchema = z.object({
  goal: z.enum(["sell", "explain", "entertain", "inform", "review", "story"]),
  platform: z.enum(["reels", "shorts", "tiktok", "youtube", "other"]),
  language: z.string().optional(),
  tone: z.array(z.string()).optional(),
  subject: SubjectSchema,
  offer: OfferSchema,
  audience: AudienceSchema,
  brandCreator: BrandCreatorSchema,
});

// Content Creation Request Schema
export const ContentCreationRequestSchema = z.object({
  id: z.string().uuid(),
  contentTypeId: z.string().uuid(),
  inputs: ContentCreationInputsSchema,
});

export type ContentCreationRequest = z.infer<typeof ContentCreationRequestSchema>;

/**
 * ============================
 * GENERATED OUTPUT SCHEMAS
 * ============================
 */

// Generated Scene (matches storyboard_v1 format)
export const GeneratedSceneSchema = SceneSchemaV1;

// Generated Output Schema
export const GeneratedOutputSchema = z.object({
  format: z.literal("storyboard_v1"),
  scenes: z.array(GeneratedSceneSchema),
  textOverlaySuggestions: z.array(z.string()).optional(),
  thumbnailPrompt: z.string().optional(),
});

export type GeneratedOutput = z.infer<typeof GeneratedOutputSchema>;
export type GeneratedScene = z.infer<typeof GeneratedSceneSchema>;

// Legacy schemas for backward compatibility (can be removed later)
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
    z.string(),
  ]),
  name: z.string(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  order: z.number().int().positive(),
  inputFrom: z.array(z.string()).optional(),
  outputTo: z.array(z.string()).optional(),
  readsFrom: z.array(z.string()).optional(),
  writesTo: z.array(z.string()).optional(),
}).passthrough();

export const AgentWorkflowSchema = z.object({
  agents: z.array(AgentDefinitionSchema),
  executionOrder: z.enum(['sequential', 'parallel', 'custom']),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AgentWorkflow = z.infer<typeof AgentWorkflowSchema>;
