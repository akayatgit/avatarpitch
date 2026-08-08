import { NextRequest, NextResponse } from 'next/server';
import { ParsedScriptSchema, ASPECT_RATIOS, type StudioScene } from '@/lib/studio';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an expert AI filmmaking assistant. The user gives you a short video script written in Tamil (or Tanglish — Tamil written with English letters). Your job is to break it into a small storyboard optimized for AI image + video generation, following these rules exactly.

OUTPUT
Return ONLY a JSON object with this exact shape (no markdown, no commentary):
{
  "title": string,            // short project title, Tanglish is fine
  "characterPrompt": string,  // English prompt to generate ONE reference/ingredient image of the main character or subject
  "scenes": [
    {
      "summary": string,      // 1-2 lines in Tanglish (Tamil + English mix) so the user can verify the scene matches their script
      "imagePrompt": string,  // English prompt describing this scene as a still frame
      "videoPrompt": string,  // English image-to-video prompt (see I2V RULES)
      "dialogue": string | null  // exact spoken line in Tamil script from the user's text, or null if the scene has no dialogue
    }
  ]
}

SCENE COUNT
Use the smallest number of scenes that covers the script: usually 2-4, never more than 6. Each scene becomes one 5-8 second video clip.

CHARACTER PROMPT RULES (reference/ingredient image)
- Describe the main character/subject in full: age, look, outfit, standing pose, front-facing, neutral background.
- Include: "soft even studio lighting from both sides, no harsh shadows, sharp facial detail, consistent facial features for use as a video ingredient reference, highly detailed, 8k quality".
- One clear light direction only. Rule-of-thirds composition where relevant.

IMAGE PROMPT RULES (per scene)
- English only. Cinematic still-frame description: subject, action frozen in a moment, place, mood.
- Always specify one clear lighting direction (e.g. "warm golden hour sunlight from the left", "soft window light").
- Include camera/lens language ("85mm lens, shallow depth of field, sharp focus") and quality keywords ("highly detailed, 8k quality") without over-stuffing.
- Begin with "Same character as the reference image, consistent facial features:" whenever the main character appears, so character consistency is preserved.

I2V RULES (videoPrompt)
- Treat the scene image as the first frame. Extend motion forward naturally.
- Describe ONE main action per scene, clearly and sequentially. No vague verbs.
- Use explicit camera terms: push, pull, pan, tilt, track, static tripod shot, handheld, close-up, wide shot.
- If the scene has dialogue, include it like: speaking naturally with accurate lip-sync, saying "<exact Tamil dialogue>" — keep the Tamil text verbatim inside the quotes.
- Do not invent new characters or locations that are not in the script.
- No text overlays. No emojis.

DIALOGUE
- Extract spoken lines exactly as written in the user's Tamil script. If a scene is narration/visual only, dialogue must be null.`;

async function callOpenAI(script: string, aspectRatio: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
          content: `Target aspect ratio: ${aspectRatio}\n\nScript (Tamil/Tanglish):\n${script}`,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI parse-script error:', errorText);
    throw new Error('Failed to analyze the script. Please try again.');
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
    const script = typeof body?.script === 'string' ? body.script.trim() : '';
    const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(body?.aspectRatio)
      ? body.aspectRatio
      : '9:16';

    if (script.length < 10) {
      return NextResponse.json(
        { error: 'Please provide your script (at least a few lines).' },
        { status: 400 }
      );
    }

    // One retry if the model returns malformed JSON
    let parsed: ReturnType<typeof ParsedScriptSchema.parse> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const raw = await callOpenAI(script, aspectRatio);
        parsed = ParsedScriptSchema.parse(JSON.parse(raw));
      } catch (error) {
        lastError = error;
        console.error(`parse-script attempt ${attempt + 1} failed:`, error);
      }
    }

    if (!parsed) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Failed to break the script into scenes.');
    }

    const scenes: StudioScene[] = parsed.scenes.map((scene, index) => ({
      id: `scene-${Date.now()}-${index + 1}`,
      summary: scene.summary,
      imagePrompt: scene.imagePrompt,
      videoPrompt: scene.videoPrompt,
      dialogue: scene.dialogue ?? null,
      // Dialogue scenes default to Veo 3.1 for native audio + lip-sync
      videoModel: scene.dialogue ? 'veo-3.1' : 'seedance-1-pro-fast',
      frameUrl: null,
      videoUrl: null,
    }));

    return NextResponse.json({
      success: true,
      title: parsed.title,
      characterPrompt: parsed.characterPrompt,
      scenes,
    });
  } catch (error) {
    console.error('parse-script error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze script' },
      { status: 500 }
    );
  }
}
