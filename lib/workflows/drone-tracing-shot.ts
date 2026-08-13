import { analyzePath } from '@/lib/tools/analyzePath';
import { parseModelJson, runGeminiVision } from '@/lib/tools/geminiVision';
import { DRONE_TRACING_SHOT } from './definitions';
import { buildSeedanceDroneMasterPrompt } from './seedanceMasterPromptTemplate';
import type { AssemblePromptResult } from './types';

export { DRONE_TRACING_SHOT };

const FLIGHT_SEQUENCE_SYSTEM = `You write the Flight Sequence bullet list for a Seedance FPV drone Master Prompt.

You see ONE image: the world still with a RED PATH drawn on it.
Seedance will receive that same single image as [Image1] — visual master + path choreography.

Rules:
- Output ONLY JSON: {"flightSequence":["...","..."], "pathAnalysis":"..."}
- flightSequence: 6 to 8 short bullets describing the camera moves along the RED PATH in order.
- Language must be GENERIC — subjects, landmarks, zones, foreground, central focal subject, open space, height — NOT only buildings/skylines.
- Each bullet starts without a leading "•" (the template adds it).
- Never mention red lines, arrows, annotations, storyboards, or UI in the bullets.
- Follow the drawn path's curves, climbs, spirals, and pullbacks exactly.
- pathAnalysis: 2–4 sentences summarizing the route for the UI.`;

export interface DroneAssembleInputs {
  locationDescription: string;
  duration?: number;
  segmentCount?: number;
  annotatedImage: string;
  inspirationImageUrl?: string;
  inspirationRead?: string;
  topic?: string;
  motionHint?: string;
}

function clampDuration(value: unknown, fallback = 12): number {
  const n = typeof value === 'number' ? Math.round(value) : fallback;
  return Math.min(Math.max(n, 3), 15);
}

function fallbackFlightSequence(
  locationDescription: string,
  landmarksInOrder: string[]
): string[] {
  const focus =
    landmarksInOrder[0] ||
    locationDescription.trim() ||
    'the central subject of the scene';
  const mid = landmarksInOrder[Math.floor(landmarksInOrder.length / 2)] || focus;
  const end =
    landmarksInOrder[landmarksInOrder.length - 1] || 'the full scene';

  return [
    `Begin with a low-altitude entry through the foreground of the scene near ${focus}.`,
    `Perform a sweeping approach around the foreground subjects while maintaining strong forward momentum.`,
    `Accelerate toward ${mid} exactly as the drawn route indicates.`,
    `Transition into a smooth climb or orbit while staying close to the primary subject.`,
    `Continue along every curve of the route without skipping sections, keeping continuous FPV momentum.`,
    `Pass the highest or deepest point of the path without stopping.`,
    `Transition into a wide pullback arc while continuing to move through the space.`,
    `Finish with a dramatic wide reveal of ${end} matching the end of the drawn route.`,
  ];
}

/** Master Prompt assembly — strict Seedance template ([Image1] visual, [Image2] path). */
export async function assembleDroneTracingPrompt(
  inputs: DroneAssembleInputs
): Promise<AssemblePromptResult> {
  const location = inputs.locationDescription.trim();
  const totalDuration = clampDuration(inputs.duration ?? 12);

  let pathAnalysis: string | null = null;
  let landmarksInOrder: string[] = [];
  try {
    const analysis = await analyzePath(inputs.annotatedImage, location);
    pathAnalysis = analysis.pathAnalysis;
    landmarksInOrder = analysis.landmarksInOrder;
  } catch (error) {
    console.warn('Drone path analysis failed, continuing with text fallback:', error);
  }

  let flightSequence: string[] | null = null;
  const visionImages = [inputs.annotatedImage];
  if (inputs.inspirationImageUrl) {
    visionImages.push(inputs.inspirationImageUrl);
  }

  try {
    const content = await runGeminiVision({
      prompt: [
        `Scene / world description: ${location}`,
        inputs.topic ? `Avatar is explaining: ${inputs.topic}` : '',
        inputs.inspirationRead ? `Inspiration read: ${inputs.inspirationRead}` : '',
        inputs.motionHint ? `Motion hint: ${inputs.motionHint}` : '',
        `Total video duration: ${totalDuration} seconds`,
        pathAnalysis ? `Path analysis:\n${pathAnalysis}` : '',
        landmarksInOrder.length
          ? `Landmarks / zones in route order: ${landmarksInOrder.join(' → ')}`
          : '',
        'Write 6–8 Flight Sequence bullets that follow the red path on the attached image. Be generic (any subject type). Do not mention the red line.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      images: visionImages,
      systemInstruction: FLIGHT_SEQUENCE_SYSTEM,
      temperature: 0.35,
    });
    const parsed = parseModelJson<{
      flightSequence?: string[];
      pathAnalysis?: string;
    }>(content);
    if (parsed?.flightSequence?.length) {
      flightSequence = parsed.flightSequence
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 8);
    }
    if (typeof parsed?.pathAnalysis === 'string' && parsed.pathAnalysis.trim()) {
      pathAnalysis = parsed.pathAnalysis.trim();
    }
  } catch (error) {
    console.warn('Drone flight-sequence vision write failed:', error);
  }

  if (!flightSequence?.length) {
    flightSequence = fallbackFlightSequence(location, landmarksInOrder);
  }

  return {
    prompt: buildSeedanceDroneMasterPrompt({
      durationSeconds: totalDuration,
      flightSequenceBullets: flightSequence,
    }),
    duration: totalDuration,
    pathAnalysis,
  };
}
