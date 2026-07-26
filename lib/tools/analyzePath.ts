import { parseModelJson, runGeminiVision } from './geminiVision';

export interface PathAnalysisResult {
  pathAnalysis: string;
  landmarksInOrder: string[];
}

const ANALYZE_SYSTEM = `You analyze an image with a RED LINE drawn on it (flight path or camera/subject track). The line ends in an arrowhead showing direction.

TRACE THE RED LINE carefully:
- Find where it STARTS (end without the arrowhead) and where it ENDS (arrowhead).
- Follow it and list EVERY landmark/structure/zone it passes over, next to, around, or through, IN ORDER.
- Note shapes: loop/circle = spiral; over a wall = sweeping pass; through a gate/arch = fly-through; straight stretches = acceleration.

Respond with ONLY this JSON (no markdown fences):
{"pathAnalysis": "<2-4 sentences: start, ordered landmarks and how the line moves, end>", "landmarksInOrder": ["<landmark 1>", "<landmark 2>", ...]}`;

/**
 * Reusable path-analysis tool. Workflows use this before assembling the Master Prompt
 * so the prompt follows what was actually drawn — not invented from text alone.
 */
export async function analyzePath(
  annotatedImage: string,
  contextDescription?: string
): Promise<PathAnalysisResult> {
  const userPrompt = contextDescription?.trim()
    ? `Context from the user:\n${contextDescription.trim()}\n\nTrace the red path on the attached image.`
    : 'Trace the red path on the attached image.';

  const content = await runGeminiVision({
    prompt: userPrompt,
    images: [annotatedImage],
    systemInstruction: ANALYZE_SYSTEM,
    temperature: 0.3,
  });

  const parsed = parseModelJson<{
    pathAnalysis?: string;
    landmarksInOrder?: string[];
  }>(content);

  if (!parsed?.pathAnalysis) {
    throw new Error('Path analysis returned unparseable output');
  }

  const landmarksInOrder = Array.isArray(parsed.landmarksInOrder)
    ? parsed.landmarksInOrder.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];

  return {
    pathAnalysis: parsed.pathAnalysis.trim(),
    landmarksInOrder,
  };
}
