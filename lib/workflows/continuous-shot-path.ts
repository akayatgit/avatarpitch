import {
  AMATEUR_CAMERA_LOCK,
  INSPIRATION_IMAGE_LOCK,
  inspirationVideoStyleBlock,
} from '@/lib/styles/surrealTech';
import { analyzePath } from '@/lib/tools/analyzePath';
import { parseModelJson, runGeminiVision } from '@/lib/tools/geminiVision';
import { clampSeedancePrompt, SEEDANCE_PROMPT_MAX_CHARS } from '@/lib/tools/seedancePrompt';
import { CONTINUOUS_SHOT_PATH } from './definitions';
import type { AssemblePromptResult } from './types';

export { CONTINUOUS_SHOT_PATH };

const NEGATIVE_PROMPT =
  'No red lines, arrows, circles, annotations, storyboard graphics, text, logos, watermarks, distorted geometry, floating objects, AI artifacts, flickering, oversaturated colors, unrealistic lighting, camera glitches, cuts, fades, transitions, teleportation, or camera resets. The red path annotation must never appear in the video.';

const CONTINUOUS_SYSTEM = `You write a CONTINUOUS-SHOT Master Prompt for Seedance 2.0 from:
- A scene description
- An annotated image [Image1] with a RED PATH (camera/subject track)
- An object reference image [Image2]
- A path analysis of that red line
- Optional object tweak text

HARD LIMIT (highest priority): The "prompt" field you return MUST be under ${SEEDANCE_PROMPT_MAX_CHARS} characters total (Seedance rejects anything over 4000). Be dense and concise — short sentences, no repetition, no filler. Prefer 4–6 compact BEATS over long prose. Skip EFFECTS DENSITY MAP and ENERGY ARC if needed to stay under the limit. Count carefully before responding.

Structure the prompt like a continuous-footage master book (keep each section SHORT):

1) MASTER DIRECTIVE — Single continuous N-second take, NO cuts. Reference [Image1] for path/composition and [Image2] for the object.
2) HARD FRAMING — Subject fully visible; action in center two-thirds when a character is present.
3) OBJECT TRAJECTORY — Object from [Image2] follows the drawn path / offset impact from the path analysis.
4) CAMERA SEQUENCE — Locked or moving as the path implies; signature finale (often zoom-out / wide reveal).
5) BEATS — Timed beats (e.g. 00:00–00:03) covering the full duration; subject motion + key effects only.
6) EFFECTS — One short bullet list of signature effects (not a novel).
7) Ambient Audio — environmental only; end with "No music, no narration, no dialogue."
8) Negative Prompt — no red lines/annotations/cuts/teleportation.

Adapt ALL of this to the USER'S surreal tech scene and object — computers/chips/code metaphors. Do NOT copy WWII / sandbag / nuclear-bomb or food-surreal examples unless the user asked for them.
Include amateur handheld smartphone camera energy (${AMATEUR_CAMERA_LOCK}).
The red line is ONLY a path guide and must NEVER appear in the video.

Respond with ONLY this JSON:
{"pathAnalysis": "<2-3 sentences>", "prompt": "<master prompt UNDER ${SEEDANCE_PROMPT_MAX_CHARS} characters>", "duration": <number of seconds, usually 12>}`;

export interface ContinuousAssembleInputs {
  sceneDescription: string;
  objectDescription?: string;
  annotatedImage: string;
  objectImage: string;
  duration?: number;
  inspirationImageUrl?: string;
  inspirationRead?: string;
  topic?: string;
  motionHint?: string;
}

/** Master Prompt assembly for Continuous Shot with Path workflow. */
export async function assembleContinuousShotPrompt(
  inputs: ContinuousAssembleInputs
): Promise<AssemblePromptResult> {
  const scene = inputs.sceneDescription.trim();
  const objectTweak = inputs.objectDescription?.trim() || '';
  // Avatar-selected Seedance duration (3–15s)
  const duration = Math.min(Math.max(Math.round(inputs.duration ?? 12), 3), 15);
  let pathAnalysis: string | null = null;
  let landmarksInOrder: string[] = [];
  try {
    const analysis = await analyzePath(
      inputs.annotatedImage,
      `${scene}${objectTweak ? `\nObject: ${objectTweak}` : ''}`
    );
    pathAnalysis = analysis.pathAnalysis;
    landmarksInOrder = analysis.landmarksInOrder;
  } catch (error) {
    console.warn('Continuous path analysis failed:', error);
  }

  const visionImages = [inputs.annotatedImage, inputs.objectImage];
  if (inputs.inspirationImageUrl) {
    visionImages.push(inputs.inspirationImageUrl);
  }

  try {
    const content = await runGeminiVision({
      prompt: [
        `Scene description:\n${scene}`,
        inputs.topic ? `Avatar is explaining: ${inputs.topic}` : '',
        INSPIRATION_IMAGE_LOCK,
        inspirationVideoStyleBlock(inputs.inspirationRead),
        objectTweak ? `Object tweak:\n${objectTweak}` : '',
        inputs.motionHint ? `Motion hint: ${inputs.motionHint}` : '',
        `Duration: ${duration} seconds`,
        pathAnalysis ? `Path analysis:\n${pathAnalysis}` : '',
        landmarksInOrder.length
          ? `Path zones in order: ${landmarksInOrder.join(' → ')}`
          : '',
        inputs.inspirationImageUrl
          ? 'Image1 = annotated path scene. Image2 = object. Image3 = PRIMARY inspiration (highest style weight).'
          : 'Image1 = annotated path scene. Image2 = object reference.',
        `Write the continuous-shot master prompt. CRITICAL: the prompt field must be under ${SEEDANCE_PROMPT_MAX_CHARS} characters (Seedance max is 4000). Keep the inspiration image look with highest preference.`,
        `Always append this Negative Prompt block at the end:\nNegative Prompt\n${NEGATIVE_PROMPT}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      images: visionImages,
      systemInstruction: CONTINUOUS_SYSTEM,
      temperature: 0.45,
      maxOutputTokens: 4096,
    });

    const parsed = parseModelJson<{
      pathAnalysis?: string;
      prompt?: string;
      duration?: number;
    }>(content);

    if (parsed?.prompt?.trim()) {
      let prompt = parsed.prompt.trim();
      if (!/negative prompt/i.test(prompt)) {
        prompt = `${prompt}\n\nNegative Prompt\n${NEGATIVE_PROMPT}`;
      }
      if (!/\[Image1\]/i.test(prompt)) {
        prompt = `Follow the red track path on [Image1] as the camera/subject motion guide. The object from [Image2] is the featured object. The red line must NEVER appear in the video.\n\n${prompt}`;
      }
      return {
        prompt: clampSeedancePrompt(prompt),
        duration:
          typeof parsed.duration === 'number'
            ? Math.min(Math.max(Math.round(parsed.duration), 3), 15)
            : duration,
        pathAnalysis: parsed.pathAnalysis?.trim() || pathAnalysis,
      };
    }
  } catch (error) {
    console.warn('Continuous master prompt vision failed:', error);
  }

  // Deterministic fallback if vision fails
  const fallback = [
    `MASTER DIRECTIVE (apply to entire generation): Single continuous ${duration}-second take, NO cuts. Follow the EXACT track drawn as the red line on [Image1] for camera/subject motion. Feature the object from [Image2]. The red line is a path guide only and must NEVER appear in the video.`,
    `Scene: ${scene}`,
    objectTweak ? `Object: ${objectTweak}` : 'Object: as shown in [Image2].',
    pathAnalysis ? `PATH ANALYSIS\n${pathAnalysis}` : '',
    `HARD FRAMING CONSTRAINT: Keep the primary subject fully visible inside the frame for the entire take. Compress large moves into the center two-thirds when a character is present. Never crop the subject off any edge.`,
    `OBJECT TRAJECTORY RULE: The object from [Image2] moves along / impacts according to the drawn path on [Image1], offset safely within frame — never unexplained teleportation.`,
    `STRICT CAMERA SEQUENCE: Continuous one-take matching the path; finish with a dramatic wide reveal / pull-back in the final seconds.`,
    `SHOT-BY-SHOT EFFECTS TIMELINE (single take — beats, not cuts)\nBEAT 1 (00:00–00:03) — Establish the locked composition from [Image1]; subject begins motion along the start of the path.\nBEAT 2 (00:03–00:06) — Continue along the path; raise tension; introduce the object from [Image2] into the trajectory.\nBEAT 3 (00:06–00:09) — Peak interaction between subject path and object trajectory.\nBEAT 4 (00:09–00:${String(duration).padStart(2, '0')}) — Signature climax + continuous zoom-out / wide reveal; hold the final epic frame.`,
    `Ambient Audio\nRealistic synchronized environmental audio only matching the scene. No music, no narration, no dialogue.`,
    `Negative Prompt\n${NEGATIVE_PROMPT}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    prompt: clampSeedancePrompt(fallback),
    duration,
    pathAnalysis,
  };
}
