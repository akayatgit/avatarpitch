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

