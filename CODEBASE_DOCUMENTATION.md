# Codebase Documentation

This document provides an overview of all files in the `components/` and `lib/` directories, their purpose, and key functionality.

## Components Directory

### content-creation/ Folder
This folder contains all components related to the content creation flow, from form input to results display.

#### generation/ Subfolder
Contains components with logic for creating the final prompt and triggering content generation.

##### CreateProjectForm.tsx
- Main form for creating content creation requests
- Dynamically generates input fields based on content type's inputsContract
- Handles form submission, progress simulation, and agent workflow visualization
- Manages scene count estimation and triggers prompt generation via server actions
- Contains logic to orchestrate the content creation flow

#### Display Components (UI/View Only)

##### AgentBreakdownDialog.tsx
- Displays detailed breakdown of agent contributions for a scene
- Shows each agent's input, output, and role in the generation process
- Used in ProjectResults to show legacy agent workflow breakdowns

##### AgentProgressFlow.tsx
- Visual component showing agent progress during content generation
- Displays animated flow of agents working on scenes
- Used in CreateProjectForm to show real-time generation progress

##### DynamicFormFields.tsx
- Utility component that dynamically renders form fields based on schema
- Supports string, enum, list, boolean, and number input types
- Handles conditional logic, validation, and help text
- Used by CreateProjectForm to render content type-specific inputs

##### GenerationBreakdownDialog.tsx
- Displays detailed generation context for a scene
- Shows final prompt, inputs, scene-specific context, and generation rules
- Provides transparency into how the AI generated the image prompt
- Used in ProjectResults when clicking info icon on scenes

##### ImageCarousel.tsx
- Carousel component for displaying multiple generated images
- Handles image navigation and click events
- Used in ProjectResults to show scene images

##### ImageGenerationDialog.tsx
- Dialog component for triggering image generation
- Provides UI for selecting image generation options
- Used in ProjectResults to generate images for scenes

##### ImageViewer.tsx
- Full-screen image viewer component
- Displays selected image with close functionality
- Used in ProjectResults for viewing images in detail

##### ProjectResults.tsx
- Main component for displaying generated content results
- Shows scenes with images, prompts, and breakdown information
- Handles image generation, download, and breakdown dialogs
- Supports both new generation context and legacy agent contributions

##### ProjectResultsClient.tsx
- Client-side wrapper for ProjectResults
- Handles client-side state and interactions
- Used in project detail pages for client-side rendering

### Other Components

### AgentList.tsx
- Renders a list of agents from the database
- Provides UI for viewing, updating, and deleting agents
- Used in the agents management page (`app/app/agents/page.tsx`)

### CollapsibleAgentForm.tsx
- Collapsible form component for creating new agents
- Handles agent creation with role, name, system prompt, and temperature
- Used in the agents management page

### CollapsibleTemplateForm.tsx
- Collapsible form component for creating new content types
- Provides quick access to content type creation without navigation
- Used in the templates listing page

### NetworkError.tsx
- Error component for displaying network-related errors
- Handles Supabase network errors and provides retry functionality
- Used across multiple pages for error handling

### ProjectList.tsx
- Lists all content creation requests (projects)
- Displays project status, creation date, and provides navigation
- Used in the main dashboard page

### ReactFlowWorkflowEditor.tsx
- Advanced workflow editor using ReactFlow library
- Visual node-based editor for configuring agent workflows
- Allows drag-and-drop agent configuration and connection
- Used in the workflow configuration page

### Sidebar.tsx
- Main navigation sidebar component
- Provides navigation links to all major sections
- Includes branding and user interface elements
- Used in the main app layout

### TemplateForm.tsx
- Form component for creating and editing content types
- Supports both form view and JSON view for editing
- Handles all ContentTypeDefinition fields including nested structures
- Used in content type creation and editing pages

### TemplateList.tsx
- Lists all content types (templates) from the database
- Displays template details and provides navigation
- Includes workflow preview functionality
- Used in the templates listing page

### WorkflowPreview.tsx
- Preview component for agent workflows
- Shows agent configuration and workflow structure
- Used in TemplateList to preview workflow before editing

## Lib Directory

### agents.ts
- Defines agent-related types, interfaces, and constants
- Exports AgentDefinition, AgentWorkflow, and AGENT_ROLES
- Provides getAgentSystemPrompt and createAgentLLM utility functions
- Used throughout the codebase for agent type definitions

### generation/ Subfolder
Contains library files with logic for generating the final prompts and orchestrating content generation.

#### contentGenerator.ts
- Main content generation orchestrator
- Handles both multi-agent and single-prompt generation paths
- Converts ContentTypeDefinition to legacy TemplateConfig format
- Calls multiAgentSceneGenerator for agent-based generation
- Used by actions.ts to generate content for creation requests

#### multiAgentSceneGenerator.ts
- Core multi-agent scene generation engine
- Implements scene dictionary generation (LLM determines scene count and purposes)
- Runs agent workflow per scene with proper chaining
- Executes agents sequentially, passing each agent's output to the next
- Final agent creates the imagePrompt by synthesizing all previous agent outputs
- Validates and returns scenes in storyboard_v1 format
- Used by contentGenerator.ts for multi-agent content generation

### networkError.ts
- Utility functions for handling network errors
- Provides isSupabaseNetworkError function for error detection
- Used across the application for error handling

### replicateImageGenerator.ts
- Image generation integration with Replicate API
- Handles model configuration and image generation requests
- Provides getModelConfig and ImageGenerationModel utilities
- Used by image generation API routes

### schemas.ts
- Comprehensive Zod schema definitions for the entire application
- Defines ContentTypeDefinition, ContentCreationRequest, and all nested schemas
- Includes validation schemas for output contracts, scene generation policies, inputs contracts, and prompting
- Exports TypeScript types inferred from Zod schemas
- Used throughout the application for type safety and validation

### supabaseAdmin.ts
- Supabase client configuration for admin operations
- Provides authenticated Supabase client with admin privileges
- Used by all server-side database operations

### studio.ts
- Shared types and Zod schemas for the mobile Studio wizard (Tamil script → video)
- Defines StudioState/StudioScene (persisted in content_creation_requests.generated_output with format 'studio_v1') and ParsedScriptSchema (LLM output contract)
- Used by the studio API routes and components/studio/*

### assembly.ts
- Shared types and Zod schemas for the Building Assembly wizard (empty plot → construction reveal video)
- Defines AssemblyState/AssemblyBuilding (persisted in content_creation_requests.generated_output with format 'assembly_v1')
- Ships the guide's two prompt templates: DEFAULT_REMOVAL_PROMPT (Prompt 1 — building removal) and DEFAULT_REVEAL_PROMPT (Prompt 2 — sequential construction animation)
- Used by the assembly API routes and components/assembly/*

### storage.ts
- Supabase Storage helper for durable public file hosting (replaces Vercel Blob)
- Ensures a public `uploads` bucket exists, uploads files, and returns public HTTPS URLs
- `persistRemoteFileToStorage` re-hosts short-lived Replicate outputs (images/videos)
- Used by `/api/upload-image`, `/api/generate-image` (persist flag), and `/api/generate-video`

## Studio (Tamil Script → Video Wizard)

Mobile-first 4-step flow at `/app/studio` that replicates the AI content creation guide: script → scenes → reference/ingredient image → image-to-video clips.

### components/studio/StudioWizard.tsx
- Client orchestrator: step indicator, state management, debounced autosave to /api/studio/save, resume via ?projectId=
- Recent studio projects list on a fresh start

### components/studio/ScriptStep.tsx
- Step 1: Tamil/Tanglish script textarea + aspect ratio picker (9:16 / 16:9 / 1:1)
- Calls /api/studio/parse-script to break the script into scenes

### components/studio/ScenesStep.tsx
- Step 2: editable scene cards (Tanglish summary, Tamil dialogue, advanced English image/video prompts), scene deletion

### components/studio/ReferenceStep.tsx
- Step 3: reference/ingredient image via photo upload (/api/upload-image) or AI generation (/api/generate-image with gpt-image-2)
- Quality checklist + regenerate loop before continuing

### components/studio/VideoStep.tsx
- Step 4: per-scene two-stage generation — scene frame (nano-banana with the reference image) then image-to-video (/api/generate-video, Seedance fast or Veo 3.1 with native audio for dialogue scenes)
- Inline video preview, download, redo, and "Generate all" sequential run

### Studio API routes
- `app/api/studio/parse-script/route.ts` — OpenAI call that converts a Tamil script into structured scenes (summary, image prompt, i2v video prompt, dialogue), Zod-validated with one retry
- `app/api/studio/save/route.ts` — upserts studio state into content_creation_requests (falls back to attaching a content type if content_type_id is NOT NULL)
- `app/api/studio/[id]/route.ts` — loads a saved studio project state
- `app/api/generate-video/route.ts` — extended with generateAudio flag (Veo native audio), durable Supabase Storage copy of output videos, and server-side persistence of clip URLs onto studio scenes
- `app/api/generate-image/route.ts` — extended with a persist flag that copies generated images to Supabase Storage (used for reference images and scene frames that are reused as video inputs)
- `app/api/upload-image/route.ts` — multipart image upload to Supabase Storage (`uploads` bucket); same `{ url }` response shape for Studio, templates, and project assets
- `migrations/create_uploads_storage_bucket.sql` — durable SQL setup for the public uploads bucket + read/write policies

## Building Assembly (Empty Plot → Construction Reveal)

Mobile-first 3-step wizard at `/app/assembly` implementing the "Transforming Empty Plots into Modern Buildings" workflow: for each building, a finished-property photo (Reference 2 / end frame) is emptied into a cleared plot with nano-banana (Reference 1 / start frame), then an 8-second video animates the building constructing itself out of the empty land.

### components/assembly/AssemblyWizard.tsx
- Client orchestrator: 3-step indicator (Buildings → Empty plot → Reveal video), debounced autosave to /api/assembly/save, resume via ?projectId=
- Recent assembly projects list on a fresh start

### components/assembly/BuildingsStep.tsx
- Step 1: project name, aspect ratio (16:9 / 9:16 / 1:1), and building count — pick 1-6 with chips or grow the list by adding reference photos ("Add another building")
- Per building: upload the finished-property reference photo (/api/upload-image) or AI-generate one from a description (/api/generate-image with gpt-image-2)
- Shows the guide's Four Golden Rules (identical framing, clean lighting, preserved environment, verify before animating)

### components/assembly/EmptyPlotStep.tsx
- Step 2 (guide Step 1): per building, generates the empty plot via nano-banana using the editable removal prompt, with aspect_ratio 'match_input_image' to preserve framing (Rule 1)
- "Tailor with AI" per building: vision call (/api/assembly/tailor-prompts) inventories the photo and rewrites both the removal and reveal prompts around the property's actual elements (like the guide's Master Prompt Library); also replaces placeholder "Building N" names with the AI's property summary
- Before/after comparison, quality checklist (Rule 4), regenerate loop, and "Clear all plots" sequential run

### components/assembly/RevealVideoStep.tsx
- Step 3 (guide Step 2): per building, 8-second reveal via /api/generate-video — empty plot as the start frame (`image`) and the original photo as the end frame (`lastFrameImage`), locked camera, editable reveal prompt
- Model toggle (Seedance fast / Veo 3.1), start/end frame preview, inline video player, download, redo, and "Generate all" sequential run
- "Tailor with AI" per building re-tailors just the reveal prompt from the original photo
- Final showcase: once every reveal is ready, stitches all clips (in building order) into one downloadable video via /api/assembly/stitch, with an optional 2-second title card rendered client-side on a canvas (real fonts) and uploaded as a PNG; any redone clip invalidates the stitched showcase

### Assembly API routes
- `app/api/assembly/tailor-prompts/route.ts` — OpenAI vision call that inventories a finished-property photo and returns property-specific removal + reveal prompts (Zod-validated with one retry); the fixed "Negative:" block is always appended server-side from REVEAL_NEGATIVE_PROMPT
- `app/api/assembly/stitch/route.ts` — ffmpeg (ffmpeg-static) pipeline: downloads the reveal clips (and optional title-card PNG), normalizes every segment to identical size/fps/codec (scale + pad, 24fps, h264, no audio), concats with stream copy, uploads the showcase MP4 to Supabase Storage, and persists finalVideoUrl onto the project
- `app/api/assembly/save/route.ts` — upserts assembly state into content_creation_requests (same content_type_id NOT NULL fallback as studio)
- `app/api/assembly/[id]/route.ts` — loads a saved assembly project state
- `app/api/generate-video/route.ts` — accepts a `buildingId` (alongside studio's `sceneId`) and persists finished clip URLs onto the matching assembly building server-side

