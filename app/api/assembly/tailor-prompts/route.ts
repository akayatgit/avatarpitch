import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_REMOVAL_PROMPT,
  DEFAULT_REVEAL_PROMPT,
  REVEAL_NEGATIVE_PROMPT,
  TailoredPromptsSchema,
} from '@/lib/assembly';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the prompt author of the "Transforming Empty Plots into Modern Buildings" workflow (Architectural Construction Reveal). The user gives you ONE photo of a finished property. Your job is to inventory exactly what is visible and tailor the workflow's two prompt templates to this specific property.

Look at the photo carefully and identify:
1. ENVIRONMENT TO KEEP (never removed): ground surface materials (asphalt, concrete, gravel, brick paving, grass), roads, lane markings, curbs, sidewalks, background trees or mountains, sky and lighting condition (bright daylight, overcast, dusk/twilight), shadow direction.
2. BUILDING INVENTORY (everything that must be removed and later re-assembled): walls with their colour and material, windows and frames, doors, rooflines, awnings, signage — quote any legible sign text VERBATIM in double quotes — outdoor furniture, planters, plants, lamps, poles, decals.

OUTPUT
Return ONLY a JSON object with this exact shape (no markdown, no commentary):
{
  "buildingSummary": string,  // one short line naming the property, e.g. '"COFFEE HOUSE" facade with topiary shrubs'
  "removalPrompt": string,    // tailored Step 1 prompt (building removal image edit)
  "revealPrompt": string      // tailored Step 2 prompt (sequential construction reveal video)
}

REMOVAL PROMPT RULES (Step 1 — image edit that empties the plot)
Follow this template structure, replacing the generic nouns with the actual items you see:
---
${DEFAULT_REMOVAL_PROMPT}
---
- First paragraph: list the actual building elements to remove (architecture, specific furniture, specific signs, specific plants).
- Second paragraph: name the actual environmental elements to keep unchanged (actual road/curb/sidewalk/tree/sky details) and specify that the cleared area is filled with the ACTUAL ground material visible in the photo (e.g. "clean matching grey gravel and stone pavers"). Name the actual lighting condition.

REVEAL PROMPT RULES (Step 2 — 8-second video, empty plot = first reference, this photo = second reference)
Follow this template structure EXACTLY, keeping every section header and all camera/interpolation constraints, but replace the generic element lists with the actual inventory:
---
${DEFAULT_REVEAL_PROMPT.replace(REVEAL_NEGATIVE_PROMPT, '').trim()}
---
- CAMERA LOCK: mention the actual persistent lines of THIS scene (e.g. "sidewalk edges, curb lines" or "gravel floor bounds, stepping stone placement").
- STRICT BUILDING INVENTORY: enumerate the actual elements (walls, windows, signs with verbatim text, furniture, plants) that must come only from the second reference image.
- ABSOLUTE LOCK: name the actual ground surfaces, background, and lighting of this photo.
- REVEAL METHOD: assign the ACTUAL elements to the four motion groups —
  POP-IN: core walls, primary door and window structures;
  DROP: awnings, glass panels, outdoor furniture, umbrellas, sign poles;
  DESCEND: wall signage/typography (quote text verbatim), hanging lights, roof vines;
  INSTANT: wall lamps, small signs, potted plants, interior accessories.
  Keep the motion definitions (undersized pop with overshoot ~0.2s, firm-settle drop, descend from above, single-frame instant).
- TIMELINE: keep the 0-2s / 2-3.5s / 3.5-5s / 5-6s / 6-8s beats but name the actual elements arriving in each window.
- Final style line: adapt to the actual lighting and building type (e.g. "soft sunset ambient light, modern minimalist cafe construction, no people").
- DO NOT include a "Negative:" section — it is appended automatically.

Write everything in English. Never invent elements that are not visible in the photo.`;

async function callOpenAIVision(imageUrl: string, buildingName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Building name (may be a placeholder): ${buildingName || 'unnamed'}\n\nAnalyze this finished property photo and return the tailored prompts JSON.`,
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI tailor-prompts error:', errorText);
    throw new Error('Failed to analyze the property photo. Please try again.');
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Empty response from the AI. Please try again.');
  }
  return content;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const buildingName = typeof body?.buildingName === 'string' ? body.buildingName.trim() : '';

    if (!/^https?:\/\//.test(imageUrl)) {
      return NextResponse.json(
        { error: 'A reference image URL is required to tailor the prompts.' },
        { status: 400 }
      );
    }

    // One retry if the model returns malformed JSON
    let parsed: ReturnType<typeof TailoredPromptsSchema.parse> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const raw = await callOpenAIVision(imageUrl, buildingName);
        parsed = TailoredPromptsSchema.parse(JSON.parse(raw));
      } catch (error) {
        lastError = error;
        console.error(`tailor-prompts attempt ${attempt + 1} failed:`, error);
      }
    }

    if (!parsed) {
      throw lastError instanceof Error ? lastError : new Error('Failed to tailor the prompts.');
    }

    // Guarantee the fixed negative block regardless of what the model produced
    let revealPrompt = parsed.revealPrompt.trim();
    const negativeIndex = revealPrompt.indexOf('Negative:');
    if (negativeIndex !== -1) {
      revealPrompt = revealPrompt.slice(0, negativeIndex).trim();
    }
    revealPrompt = `${revealPrompt}\n\n${REVEAL_NEGATIVE_PROMPT}`;

    return NextResponse.json({
      success: true,
      buildingSummary: parsed.buildingSummary,
      removalPrompt: parsed.removalPrompt.trim(),
      revealPrompt,
    });
  } catch (error) {
    console.error('tailor-prompts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to tailor prompts' },
      { status: 500 }
    );
  }
}
