# Surreal Tech Theme (shared across all workflows)

## Product intent

Avatar educators explain **computers / chips / programming / coding** with **minimalist surreal** stills:

- **One hero** from the inspiration image (keep pose / subjects)
- **One clean twist** tied to the teaching topic (material swap, prop metaphor, or gentle scale gag)
- **Noise-free** — solid/simple backdrop, large negative space, hyperreal but sparse

Gold-standard energy: brain-as-mouse on white; giraffe + one neck cloud; donkey with phone blinkers; single giant phone monolith — **not** crowded chip continents or busy cyber landscapes.

## First step in every workflow

1. Paste a **Pinterest / inspiration image URL** → thumbnail (`POST /api/resolve-inspiration-image`)
2. Enter **what the avatar will explain**
3. Suggest → generate **6 Nano Banana 2** concept stills (search grounding on) → pick one → text corrections → GPT Image **2K** refine
4. Continue workflow with that HQ still

**Highest weight:** inspiration subjects + minimalist composition. Refs for HQ refine: `[inspiration, draft]`.

Code: `lib/styles/surrealTech.ts` (`MINIMALIST_SURREAL_LOCK`, `applyInspirationImageLocks`)  
UI: `components/workflows/SurrealIdeationStep.tsx`  
Tools: `suggestFootage`, `resolveInspirationImage`

## Camera feel

Still/video prompts: clean, graphic, poster-like. Avoid frantic noise.

## When themes change

Update locks in `surrealTech.ts` + this doc. Do not fork per-workflow style lists.
