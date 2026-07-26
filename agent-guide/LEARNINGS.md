# Learnings

## Path-guided video

1. **Text-only prompts ignore the drawing.** If the assembler only sees the location text, it invents a route around the first landmark. Always send the annotated image to Gemini vision (`analyzePath` / assemble with images) so segments follow the actual red line.
2. **Seedance reference mode, not first-frame.** For "draw the path" trends, pass the annotated still as `reference_images` (`[Image1]`), not as `image` first-frame — and put "red line must NEVER appear" in the negative prompt.
3. **Cannot mix** Seedance `reference_images` with first/last frame images on the same call.
4. **Overlapping / crossed strokes** confuse vision. Prefer one continuous line with clear direction (arrowhead).

## Continuous shot with object

5. Object must be a **second reference image** (`[Image2]`), not only text, when the Master Prompt Book says "add your object as second reference."
6. Continuous books need **fixed structural blocks** (MASTER DIRECTIVE, HARD FRAMING, BEATS, EFFECTS) adapted to the user's scene — do not hardcode the example WWII/nuclear copy unless the user asked for it.
7. **Seedance prompt max is 4000 characters.** Assemble-prompt LLM calls must require under **3500** chars; `clampSeedancePrompt` is a last-resort safety net in `generateVideo`.

## Product

8. Fixed 10s teaching B-roll with no VO/stitch fails engagement. Path-guided cinematic one-takes are the current product direction.
9. Always show **path analysis** to the avatar before spending a video generation so they can redraw if the trace is wrong.
10. **Suggestion fidelity:** Nano Banana drafts must **~80% replicate** the Pinterest inspiration (subjects/pose/composition/look); ~20% diorama/tech adapt. Diorama sentence template + search grounding. HQ refine stays GPT Image 2.
14. **Seedance drone prompt:** ONE reference image only — the annotated still as `[Image1]` (scene + red path). Prompt preserves the underlying scene and treats the red route as choreography that must never appear. Template: `seedanceMasterPromptTemplate.ts`.
12. **Amateur handheld** camera language in Seedance prompts increases dynamism for surreal clips (per viral Seedance craft).
13. **Seedance E005 "sensitive":** Usually **image size/format**, not the prompt. Always compress refs to **JPEG ≤ ~900KB**, max edge 1280 (`prepareSeedanceReferenceImages`). Keep Grok Imagine as fallback. Video models: `lib/tools/videoModels.ts`.
