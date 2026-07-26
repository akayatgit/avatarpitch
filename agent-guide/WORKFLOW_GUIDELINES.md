# Workflow Guidelines

## Rule: tools first, workflows second

When a new Master Prompt Book arrives:

1. Map its steps to **existing tools** in `lib/tools/` and shared APIs.
2. Only add a new tool if no existing tool can do the job.
3. Add a workflow definition under `lib/workflows/`.
4. Add a studio UI under `components/workflows/<id>/` that only calls shared APIs.
5. Register it in `lib/workflows/registry.ts`.
6. Document it under `agent-guide/workflows/<id>.md` and update LEARNINGS if something new was learned.

## Shared tools

| Tool | Location | API |
|------|----------|-----|
| `suggestFootage` | `lib/tools/suggestFootage.ts` | `POST /api/suggest-footage` |
| `generateImage` | `lib/tools/imageGeneration.ts` | `POST /api/generate-image` |
| `analyzePath` | `lib/tools/analyzePath.ts` | `POST /api/analyze-path` |
| `assemblePrompt` | `lib/workflows/assemblePrompt.ts` | `POST /api/assemble-prompt` |
| `generateVideo` | `lib/tools/seedanceVideo.ts` | `POST /api/generate-video` |
| `PathDrawingCanvas` | `components/tools/PathDrawingCanvas.tsx` | (client) |
| `localImage` | `lib/tools/localImage.ts` | (client) |
| `runGeminiVision` | `lib/tools/geminiVision.ts` | used by analyze/assemble |
| Surreal style presets | `lib/styles/surrealTech.ts` | (shared) |

Every new workflow should start with **Style & Idea** (`SurrealIdeationStep`) unless a future Master Prompt Book explicitly skips it.

## Shared API contracts

### `POST /api/generate-image`

```json
{ "scenePrompt": "...", "mode": "aerial|scene|none", "numImages": 1, "size": "2K" }
```

### `POST /api/analyze-path`

```json
{ "annotatedImage": "<data url or https>", "contextDescription": "optional" }
```

### `POST /api/assemble-prompt`

```json
{ "workflowId": "drone-tracing-shot|continuous-shot-path", "inputs": { } }
```

### `POST /api/generate-video`

```json
{
  "prompt": "...",
  "referenceImages": ["[Image1]", "[Image2]"],
  "duration": 12,
  "resolution": "720p"
}
```

Prompt text must reference `[Image1]`, `[Image2]`, … in the same order as `referenceImages`.

## Checklist for a new Master Prompt Book

- [ ] Identify ordered steps
- [ ] Reuse tools (no duplicate Replicate model wrappers)
- [ ] Write `assembleXPrompt` with fixed book blocks + vision-filled beats
- [ ] Register workflow + picker card
- [ ] Agent-guide workflow doc
- [ ] Note learnings
