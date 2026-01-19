import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const VIDEO_PROMPT_SYSTEM_PROMPT = `You are a professional prompt writer specialized in Seedance 1.5 Pro image-to-video (i2v) generation.

Your task is to write high-quality i2v prompts, not generate videos.
All outputs must be ready-to-use prompts that strictly follow the Seedance 1.5 Pro Prompt Guide.

1. Role & Output Format

Output only prompt text, never explanations unless asked.

Use natural language optimized for Seedance i2v understanding.

Write prompts in English unless the user requests another language.

Assume an input image is always provided.

2. i2v Prompt Rules

Treat the input image as the first frame.

Preserve subject identity, composition, lighting, and style from the image.

Extend motion forward in time naturally.

Do not invent new characters or locations unless instructed.

3. Action Writing Guidelines

Describe actions clearly and sequentially.

Avoid vague verbs like “somehow” or “suddenly”.

When multiple actions occur, order them by time.

Good:
i2v: The man lifts his head, looks forward, then starts walking.

Bad:
i2v: The man changes position and does something dynamic.

4. Camera & Lens Language

Use explicit camera terms:

Push, pull, pan, tilt, track, follow

Aerial, over-the-shoulder, handheld

Macro, close-up, wide shot, low-angle

Use camera switch to separate shots.

Example:
i2v: The camera follows the subject from behind. Camera switch. The camera moves ahead and faces the subject.

5. Shot Size & Composition

Clearly state framing and perspective.

Respect foreground/background relationships.

Macro shots must emphasize fine detail.

Example:
i2v: Macro photography of the character’s hand gripping the fabric.

6. Multi-Scene Prompt Writing

Support multiple scenes in one prompt.

Maintain continuity unless a scene change is specified.

Use camera switch for each new shot.

7. Visual Aesthetic Control

Specify style, era, and texture when needed:

Black-and-white, vintage film, modern cinematic

Film grain, high contrast, soft lighting

Keep style consistent unless instructed to change.

Example:
i2v: A high-contrast black-and-white film look with visible grain.

8. Atmosphere & Mood

Describe mood using physical cues (light, motion, spacing).

Avoid abstract emotional language without visual grounding.

Good:
i2v: A tense atmosphere with tight framing and shaky handheld movement.

Bad:
i2v: A very emotional and intense feeling.

9. Parameter Writing

Append model parameters only when requested.

Use correct syntax.

Example:
i2v: The woman exhales and closes her eyes. --resolution 1080p --duration 5 --camerafixed false

10. Restrictions

Do not include explanations, tips, or commentary.

Do not include emojis.

Do not describe audio unless requested.

Do not add text overlays unless explicitly asked.

11. Example i2v Prompts

Example 1 – Simple:
i2v: The man slowly turns his head and looks into the camera.

Example 2 – Camera Movement:
i2v: The camera gently pushes in as the woman lifts her eyes and breathes out.

Example 3 – Multi-Scene:
i2v: The boy stands still holding a kite. Camera switch. The camera pans left to reveal children running past him.

Example 4 – Macro Detail:
i2v: Macro photography of dust falling from the character’s fingers as the hand opens.

12. Goal

Your goal is to produce precise, cinematic, Seedance-optimized i2v prompts that:

Are easy for the model to understand

Generate predictable, high-quality results

Respect realism, continuity, and visual logic`;

async function convertImagePromptToVideoPrompt(sourcePrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not configured. Using source prompt as fallback.');
    return sourcePrompt;
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
        { role: 'system', content: VIDEO_PROMPT_SYSTEM_PROMPT },
        { role: 'user', content: sourcePrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to generate video prompt:', errorText);
    return sourcePrompt;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim().length > 0 ? content.trim() : sourcePrompt;
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, prompt, sourcePrompt, fps, duration, resolution, aspectRatio, cameraFixed, lastFrameImage, model } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image URL is required' }, { status: 400 });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Use the first image URL as input for video generation
    // Note: The seedance model typically uses a single image input
    const inputImageUrl = imageUrls[0];

    const selectedModel = model || 'seedance-1.5-pro';
    const basePrompt =
      prompt ||
      (sourcePrompt ? await convertImagePromptToVideoPrompt(sourcePrompt) : '') ||
      'model showcasing the jewellery with smile and head movement';
    const videoDuration = duration || 5;
    const videoResolution = resolution || '720p';
    const videoAspectRatio = aspectRatio || '9:16';

    let input: Record<string, any>;
    let modelId: string;

    if (selectedModel === 'veo-3.1') {
      modelId = 'google/veo-3.1';
      const allowedDurations = new Set([4, 6, 8]);
      const veoDuration = typeof duration === 'number' && allowedDurations.has(duration) ? duration : 6;
      input = {
        prompt: basePrompt,
        duration: veoDuration,
        resolution: videoResolution,
        aspect_ratio: videoAspectRatio,
        generate_audio: false,
        reference_images: [],
        image: inputImageUrl,
      };
      if (lastFrameImage) {
        input.last_frame = lastFrameImage;
      }
    } else {
      modelId = 'bytedance/seedance-1.5-pro';
      input = {
        fps: fps || 24,
        prompt: basePrompt,
        duration: videoDuration,
        resolution: videoResolution,
        aspect_ratio: videoAspectRatio,
        camera_fixed: cameraFixed !== undefined ? cameraFixed : true,
        image: inputImageUrl, // The image input parameter for seedance model
      };
      if (lastFrameImage) {
        input.last_frame_image = lastFrameImage;
      }
    }

    const output = await replicate.run(modelId as `${string}/${string}`, { input });

    // Process output - handle various output formats
    // According to user's reference, output may have a .url() method directly
    let videoUrl: string | null = null;
    
    if (output && typeof output.url === 'function') {
      // Handle case where output itself has .url() method
      const urlResult = output.url();
      videoUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
    } else if (typeof output === 'string') {
      // Handle case where output is directly a URL string
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      // Handle array output
      const firstItem = output[0];
      if (typeof firstItem === 'string') {
        videoUrl = firstItem;
      } else if (firstItem && typeof firstItem.url === 'function') {
        const urlResult = firstItem.url();
        videoUrl = typeof urlResult === 'string' ? urlResult : String(urlResult);
      } else if (firstItem && typeof firstItem === 'object' && firstItem.url) {
        videoUrl = typeof firstItem.url === 'string' ? firstItem.url : String(firstItem.url);
      }
    } else if (output && typeof output === 'object' && output.url) {
      // Handle object with url property (string)
      videoUrl = typeof output.url === 'string' ? output.url : String(output.url);
    }

    if (!videoUrl) {
      console.error('Unexpected output format from Replicate:', JSON.stringify(output, null, 2));
      throw new Error('Unexpected output format from Replicate - no valid video URL found');
    }

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status: 500 }
    );
  }
}

