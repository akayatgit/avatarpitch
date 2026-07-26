# Workflow: Continuous Shot with Path

**ID:** `continuous-shot-path`  
**Code:** `lib/workflows/continuous-shot-path.ts`  
**UI:** `components/workflows/continuous-shot-path/ContinuousShotStudio.tsx`

## What it is

Continuous cinematic footage guided by a drawn track path on a scene still, with a featured **object as second reference**. Based on the AI Creator Master Prompt Book (continuous take, beats, effects inventory, energy arc).

## Inputs

- Scene description
- Base scene image — **upload OR AI-generate** (`mode: 'scene'`)
- Object reference image (required) + optional text tweak
- Resolution (720p / 480p)
- Duration default **12s**

## Tool order

1. **Collect inputs** — scene text; base upload/generate; object upload
2. **`PathDrawingCanvas`** — red camera/subject track on the base
3. **`analyzePath`** — Gemini traces the line (with scene/object context)
4. **`assemblePrompt`** — Continuous Master Prompt (directive, framing, beats, effects, energy arc) adapted to user scene/object
5. **`generateVideo`** — Seedance `referenceImages: [annotatedPath, objectImage]`

## Master Prompt shape (from creator book)

- MASTER DIRECTIVE — single continuous take, no cuts
- HARD FRAMING CONSTRAINT — subject stays in frame / center-stage when applicable
- OBJECT TRAJECTORY RULE — object from `[Image2]` follows path / offset logic
- STRICT CAMERA SEQUENCE — often locked then signature zoom-out reveal
- SHOT-BY-SHOT EFFECTS TIMELINE — timed BEATS
- MASTER EFFECTS INVENTORY + DENSITY MAP + ENERGY ARC
- Ambient Audio (no music/narration)
- Negative Prompt (no red lines / annotations / cuts)

Adapt to the user's scene — do not hardcode the WWII nuclear example unless requested.

## Seedance contract

| Slot | Asset |
|------|--------|
| `[Image1]` | Annotated scene still (track path drawn) |
| `[Image2]` | Object / prop reference |
