# Multi-Agent Workflow System

## Overview

AvatarPitch now uses a **multi-agent workflow system** where specialized AI agents collaborate to generate video scenes. Each agent has a specific role (Fashion Expert, Fabrics Expert, Sales Person, etc.) and can be configured to work together in different ways.

## Architecture

### Agent Roles

The system supports 8 specialized agent roles:

1. **Fashion Expert** - Trends, styles, and aesthetics
2. **Fabrics Expert** - Textile properties and material benefits
3. **Sales Person** - Compelling offers and value propositions
4. **Trend Identifier** - Current market trends and patterns
5. **Video Director** - Camera angles and visual composition
6. **Copywriter** - On-screen text and messaging
7. **Brand Strategist** - Brand positioning and audience psychology
8. **Visual Stylist** - Color, composition, and aesthetic appeal

### Workflow Execution Modes

1. **Sequential** - Agents execute one after another, each building on previous outputs
2. **Parallel** - All agents execute simultaneously
3. **Custom** - Agents execute based on their connections (inputFrom/outputTo)

### Agent Configuration

Each agent can be configured with:
- **Role** - Specialized expertise area
- **Custom System Prompt** - Override default role prompt
- **Temperature** - Creativity level (0-2)
- **Order** - Execution sequence
- **Connections** - Which agents provide input/output

## How It Works

### 1. Workflow Definition

Workflows are defined in template configurations:

```json
{
  "workflow": {
    "agentWorkflow": {
      "agents": [
        {
          "id": "agent_1",
          "role": "fashion_expert",
          "name": "Fashion Expert",
          "order": 1,
          "temperature": 0.7
        },
        {
          "id": "agent_2",
          "role": "video_director",
          "name": "Video Director",
          "order": 2,
          "inputFrom": ["agent_1"],
          "temperature": 0.8
        }
      ],
      "executionOrder": "sequential"
    },
    "sceneBlueprint": [
      {
        "type": "hook",
        "goal": "Grab attention",
        "agentIds": ["agent_1", "agent_2"]
      }
    ]
  }
}
```

### 2. Scene Generation Process

For each scene:

1. **Agent Selection** - Filter agents based on `sceneBlueprint.agentIds`
2. **Workflow Execution** - Run selected agents according to execution order
3. **Output Assembly** - Combine agent outputs into scene structure:
   - `visualPrompt` - From Visual Stylist or Video Director
   - `camera` - From Video Director
   - `onScreenText` - From Copywriter
   - `notes` - Combined from all agents

### 3. Agent Output Combination

The system intelligently combines outputs:
- Video Director provides camera angles and movements
- Visual Stylist provides visual descriptions
- Copywriter provides on-screen text
- Other agents contribute notes and recommendations

## Workflow Editor

### Access

Navigate to: `/app/templates/[templateId]/workflow`

Or click "Edit Workflow" button on any template card.

### Features

1. **Add Agents** - Select from available roles
2. **Configure Agents**:
   - Custom system prompts
   - Temperature settings
   - Execution order
3. **Connect Agents** - Set up input/output relationships
4. **Set Execution Order** - Sequential, Parallel, or Custom
5. **Save Workflow** - Persists to template config

### UI Components

- **Agent Cards** - Expandable cards showing agent configuration
- **Connection UI** - Visual representation of agent relationships
- **Execution Order Selector** - Choose how agents run
- **Save Button** - Persist changes to database

## Example Workflows

### Fashion Product Workflow

```
1. Trend Identifier → Identifies current trends
2. Fashion Expert → Analyzes style and aesthetics (uses Trend Identifier output)
3. Fabrics Expert → Highlights material benefits
4. Visual Stylist → Creates visual presentation (uses Fashion + Fabrics outputs)
5. Video Director → Determines camera work (uses Visual Stylist output)
6. Copywriter → Writes on-screen text
7. Sales Person → Creates compelling offer
```

### Simple UGC Workflow

```
1. Brand Strategist → Understands target audience
2. Video Director → Creates camera plan
3. Copywriter → Writes engaging copy
```

## Benefits

1. **Specialization** - Each agent focuses on their expertise
2. **Collaboration** - Agents build on each other's outputs
3. **Flexibility** - Easy to add/remove agents
4. **Customization** - Per-template agent configurations
5. **Scalability** - Add new agent roles as needed

## Technical Implementation

### Files

- `lib/agents.ts` - Agent definitions and execution logic
- `lib/multiAgentSceneGenerator.ts` - Multi-agent scene generation
- `lib/sceneAgent.ts` - Main entry point (routes to multi-agent or legacy)
- `components/WorkflowEditor.tsx` - UI for editing workflows
- `app/api/templates/[id]/workflow/route.ts` - API endpoint for saving workflows

### Data Flow

```
User Form → generateProject() → generateScenes() 
  → generateScenesWithAgents() → executeWorkflow() 
    → executeAgent() (for each agent) 
      → assembleSceneFromAgentOutputs() 
        → Return scenes + renderingSpec
```

## Migration

Existing templates continue to work with the legacy single-agent system. To use multi-agent workflows:

1. Open template in workflow editor
2. Add agents
3. Configure connections
4. Save workflow

The system automatically detects agent workflows and uses them instead of the legacy prompt-based approach.

