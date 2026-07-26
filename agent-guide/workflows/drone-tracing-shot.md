# Workflow: Drone Tracing Shot

**ID:** `drone-tracing-shot`  
**Code:** `lib/workflows/drone-tracing-shot.ts`  
**UI:** `components/workflows/drone-tracing-shot/DroneTracingShotStudio.tsx`

## What it is

Draw a red FPV flight path on an aerial still; Seedance 2.0 flies that exact route as a continuous one-take with native ambient audio.

## Inputs

- Location / landmarks description
- Segment count (3–5 → 9–15s)
- Resolution (720p / 480p)

## Tool order

1. **Collect inputs**
2. **`generateImage`** (`mode: 'aerial'`) — one 9:16 aerial still of all landmarks
3. **`PathDrawingCanvas`** — red flight path + arrowhead
4. **`analyzePath`** — Gemini traces the line
5. **`assemblePrompt`** — FPV 3s segments + fixed Camera / Visual / Ambient / Negative blocks
6. **`generateVideo`** — Seedance `referenceImages: [annotatedPath]` as `[Image1]`

## Master Prompt shape

- Path lock referencing `[Image1]`
- Timestamped 3-second blocks following the traced landmarks in order
- Camera Style / Visual Style / Ambient Audio (fixed + location-aware audio)
- Negative Prompt (no red lines, no cuts, no warped landmarks)

## Seedance contract

| Slot | Asset |
|------|--------|
| `[Image1]` | Annotated aerial still (path drawn) |
