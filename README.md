# Hauloo — Master Prompt Footage Workflows

Avatar creators pick a template, fill inputs, and download AI footage for Instagram Reels. Each template is a **Master Prompt workflow**: reusable tools called in the order the prompt book requires.

**Read [`agent-guide/`](./agent-guide/) first** — product context, tool reuse rules, learnings, and per-workflow definitions.

## Current templates

Both start with **inspiration image + idea** (paste a Pinterest URL → thumbnail → say what you'll explain → generate 6 Nano Banana 2 concept stills → pick one → text corrections → high-quality refine). The inspiration image keeps highest style weight; the picked draft locks composition.

1. **Drone Tracing Shot** — style/idea → aerial world still → draw flight path → FPV prompt → Seedance `[Image1]`
2. **Continuous Shot with Path** — style/idea → scene + object → draw track → continuous Master Prompt → Seedance `[Image1]` + `[Image2]`

Theme rules: computers/chips/code with **minimalist surreal** stills (one hero, one twist, noise-free). See [`agent-guide/SURREAL_TECH_THEME.md`](./agent-guide/SURREAL_TECH_THEME.md).

## Shared tools (do not duplicate)

| Tool | API |
|------|-----|
| Surreal footage ideation | `POST /api/suggest-footage` |
| GPT Image 2 stills | `POST /api/generate-image` |
| Gemini path analysis | `POST /api/analyze-path` |
| Master Prompt assembly | `POST /api/assemble-prompt` |
| Seedance 2.0 video | `POST /api/generate-video` (`referenceImages[]`) |
| Path drawing canvas | `components/tools/PathDrawingCanvas.tsx` |

Workflow recipes live in `lib/workflows/`. Studios live in `components/workflows/`.

## Setup

```bash
npm install
```

`.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key   # optional fallbacks
OPENAI_MODEL=gpt-4o-mini
REPLICATE_API_TOKEN=your_replicate_token
```

```bash
npm run dev
```

Open http://localhost:3001/app — pick a template (no login).

## Adding a new Master Prompt Book

Follow [`agent-guide/WORKFLOW_GUIDELINES.md`](./agent-guide/WORKFLOW_GUIDELINES.md): reuse tools, declare step order, register the workflow, document under `agent-guide/workflows/`.
