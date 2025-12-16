# AvatarPitch MVP

A minimal SaaS MVP for AI-powered video generation. Business owners organize content by Workspaces, use Templates to define generation workflows, and generate video projects on-demand with zero manual intervention.

## Features

- **Workspaces**: Organize projects by business unit (e.g., `winterwears`, `kurtasets`)
- **Templates**: JSON-based configurations for LangChain agent workflows
- **Stateless Projects**: Generate videos on-demand, no storage required
- **LangChain Integration**: OpenAI-powered scene generation with structured JSON output
- **Zero Auth**: Simple setup, no authentication required

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- TailwindCSS
- Supabase Postgres (DB only)
- LangChain (JS/TS) + OpenAI API
- Zod for validation
- Server Actions for mutations

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

**Note:** `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`.

### 3. Database Setup

Run the SQL migration in your Supabase SQL editor:

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase.sql`
4. Run the migration

This will create:
- `templates` table with 3 seeded templates
- `workspaces` table with a default workspace

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── app/
│   │   ├── actions.ts          # Server actions (bootstrap, CRUD, generate)
│   │   ├── page.tsx             # Dashboard
│   │   ├── workspaces/
│   │   │   └── page.tsx         # Workspace management
│   │   ├── templates/
│   │   │   └── page.tsx         # Template management
│   │   └── create/
│   │       └── page.tsx         # Project generation form
│   ├── api/
│   │   └── download/
│   │       └── route.ts         # Render bundle download
│   ├── globals.css              # Tailwind imports
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Redirect to /app
├── components/
│   ├── Nav.tsx                  # Navigation component
│   ├── WorkspaceForm.tsx        # Create workspace form
│   ├── WorkspaceList.tsx        # Workspace list with template selector
│   ├── TemplateForm.tsx         # Create template form
│   ├── TemplateList.tsx         # Template list
│   ├── CreateProjectForm.tsx    # Project generation form
│   └── ProjectResults.tsx       # Generated project display
├── lib/
│   ├── supabaseAdmin.ts         # Supabase admin client
│   ├── schemas.ts               # Zod validation schemas
│   └── sceneAgent.ts            # LangChain scene generation
└── supabase.sql                 # Database migration
```

## Usage

### Creating a Workspace

1. Navigate to **Workspaces** page
2. Enter a workspace name (e.g., `winterwears`)
3. Click "Create Workspace"
4. Select a template from the dropdown for the workspace

### Creating a Template

1. Navigate to **Templates** page
2. Enter template name and description
3. Paste JSON config in the textarea (validated with Zod)
4. Click "Create Template"

Template config structure:
```json
{
  "version": 1,
  "output": {
    "sceneCount": 5,
    "minSceneSeconds": 3,
    "maxSceneSeconds": 7,
    "aspectRatio": "9:16",
    "style": "UGC"
  },
  "workflow": {
    "systemPrompt": "...",
    "sceneBlueprint": [...],
    "constraints": [...]
  }
}
```

### Generating a Project

1. Navigate to **Create Project** page
2. Fill in the form:
   - Select workspace (must have template assigned)
   - Product name (required)
   - Product link (optional)
   - Offer (required)
   - Features (optional, comma-separated, max 5)
   - Target audience (optional)
   - Platform: TikTok/Reels/Shorts (required)
3. Click "Generate Project"
4. View generated scenes and rendering spec
5. Download render bundle as JSON
6. Click "Start New" to generate another project

## Generated Output Format

The system generates a JSON structure with:

- **scenes**: Array of scene objects with:
  - `index`: Scene number (1-N)
  - `durationSeconds`: Duration in seconds
  - `visualPrompt`: Visual description
  - `camera`: Camera angle/movement
  - `onScreenText`: Optional text overlay
  - `notes`: Optional production notes

- **renderingSpec**: Rendering configuration:
  - `aspectRatio`: Video aspect ratio
  - `style`: Visual style
  - `musicMood`: Background music mood
  - `transitions`: Transition style

## Notes

- Projects are **stateless**: generated on submit, not stored in database
- Only Workspaces and Templates are persisted
- Video preview uses a mock URL (replace with actual rendering service)
- No authentication required for MVP
- LangChain agent retries once if JSON parsing fails

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT

