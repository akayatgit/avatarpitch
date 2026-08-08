import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/seed-content-types
 *
 * Idempotent: inserts content types that don't already exist (matched by name).
 * Safe to call multiple times.
 */
export const dynamic = 'force-dynamic';

const ROLE_REVEAL_CAROUSEL = {
  name: 'Role Reveal Carousel',
  category: 'entertainment',
  description:
    'Show everyone together on the first slide, then reveal each person dressed as their job role one by one — same visual style throughout.',
  version: '1.0.0',
  output_contract: {
    format: 'storyboard_v1',
    requiredOutputs: {
      scenes: true,
      imagePromptPerScene: true,
      textOverlaySuggestions: false,
      thumbnailPrompt: false,
    },
    sceneSchema: {
      id: '',
      purpose: '',
      imagePrompt: '',
      negativePrompt: '',
      camera: {},
      environment: {},
      characters: [],
      props: [],
      onScreenText: {},
      compositionNotes: '',
    },
    globalDefaults: {
      durationPerSceneSeconds: 3,
      allowedAspectRatios: ['9:16'],
      defaultAspectRatio: '9:16',
      visualStylePreset: 'cinematic portrait',
      defaultLanguage: 'en',
    },
  },
  scene_generation_policy: {
    mode: 'fixed_carousel',
    minScenes: 3,
    maxScenes: 12,
    rules: {
      mustStartStrong: true,
      mustEndWithClosure: true,
    },
  },
  inputs_contract: {
    fields: [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        required: true,
        maxLength: 80,
        helpText: 'e.g. "Meet Our Hauloo Team" — shown on the first and last slide.',
      },
      {
        key: 'jobRoles',
        label: 'Job Roles',
        type: 'list',
        required: true,
        listSeparator: 'newline',
        maxItems: 10,
        helpText: 'One role per line, e.g. "Software Engineer". Must match the order of Face Images.',
      },
      {
        key: 'faceImages',
        label: 'Face Images',
        type: 'list',
        required: true,
        listSeparator: 'newline',
        maxItems: 10,
        helpText:
          'One direct image URL per line (same order as Job Roles). Each photo is used as the face reference for that person\'s role slide.',
      },
    ],
  },
  prompting: {
    systemPromptTemplate:
      'You are a creative director producing a "Role Reveal" carousel. ' +
      'The first slide shows everyone together with the title. ' +
      'Each subsequent slide reveals one person dressed as their specific job role, ' +
      'maintaining their exact face from the reference photo. ' +
      'Consistent cinematic studio lighting and dark background across all slides.',
    fixedCarousel: {
      // Both jobRoles and faceImages are zipped by index into per-person rows.
      itemFieldKeys: ['jobRoles', 'faceImages'],
      // Per-item: pass each person's face photo as the reference image for that slide.
      itemLogoFieldKey: 'faceImages',
      // Hook: pass ALL face photos as reference images so the model can depict the full group.
      hookUseAllItemImages: true,
      maxItems: 10,

      hookPromptTemplate:
        'Cinematic group portrait of all team members standing together in a dark studio, ' +
        'faces clearly visible, looking at the camera with confident expressions. ' +
        'Dramatic spotlighting, professional photography style. ' +
        'Bold centered text overlay at top: "{{Title}}". ' +
        '9:16 vertical format, photorealistic, no watermarks or logos.',

      itemPromptTemplate:
        'Photorealistic studio portrait of the exact same person from the reference photo, ' +
        'now fully dressed and styled as a {{Job Roles}}. ' +
        'Keep the face, skin tone, and features identical to the reference. ' +
        'Authentic {{Job Roles}} costume, tools, or props in frame. ' +
        'Dark studio background, dramatic spotlight, same cinematic style as the other slides. ' +
        'Bold text overlay at bottom center: "{{Job Roles}}". ' +
        '9:16 vertical format, photorealistic, no watermarks.',

      ctaPromptTemplate:
        'Elegant closing slide on a deep black background with a soft radial spotlight. ' +
        'Large bold centered text: "{{Title}}". ' +
        'Subtle gradient glow behind the text. ' +
        '9:16 vertical format, clean and cinematic, no watermarks.',

      footerText: '',
    },
  },
};

export async function GET() {
  try {
    // Check which content types already exist
    const names = [ROLE_REVEAL_CAROUSEL.name];
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('content_types')
      .select('name')
      .in('name', names);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingNames = new Set((existing ?? []).map((r: any) => r.name));

    const toInsert = [ROLE_REVEAL_CAROUSEL].filter((ct) => !existingNames.has(ct.name));

    if (toInsert.length === 0) {
      return NextResponse.json({ message: 'All content types already seeded.', seeded: [] });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('content_types')
      .insert(toInsert)
      .select('id, name');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      seeded: (inserted ?? []).map((r: any) => ({ id: r.id, name: r.name })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
