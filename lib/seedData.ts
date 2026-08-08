/**
 * Canonical content-type seed definitions.
 *
 * Each object matches the `content_types` table columns exactly.
 * Import this wherever you need to seed or reference the built-in content types.
 *
 * Usage: call `ensureContentTypesSeeded()` from any server-side code
 * (e.g. the Apps page) to guarantee the rows exist.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ---------------------------------------------------------------------------
// Job Openings Instagram Carousel
// ---------------------------------------------------------------------------
const JOB_OPENINGS_CAROUSEL = {
  name: 'Job Openings Carousel',
  category: 'marketing',
  description:
    'A deterministic Instagram carousel for recruiting: one hook slide, one slide per opening, and a closing CTA — all generated consistently from a list of job titles.',
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
      visualStylePreset: 'professional recruiting',
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
        key: 'brandName',
        label: 'Brand Name',
        type: 'string',
        required: true,
        maxLength: 80,
        helpText: 'Your company or brand name, shown on every slide.',
      },
      {
        key: 'logoUrl',
        label: 'Logo URL',
        type: 'string',
        required: false,
        helpText: 'Direct URL to your logo image — used as a reference on the hook slide.',
      },
      {
        key: 'jobTitles',
        label: 'Job Titles',
        type: 'list',
        required: true,
        listSeparator: 'newline',
        maxItems: 10,
        helpText: 'One job title per line, e.g. "Senior Designer". Must match the order of Job Locations.',
      },
      {
        key: 'jobLocations',
        label: 'Job Locations',
        type: 'list',
        required: false,
        listSeparator: 'newline',
        maxItems: 10,
        helpText: 'One location per line (same order as Job Titles), e.g. "Remote" or "New York, NY".',
      },
      {
        key: 'ctaText',
        label: 'CTA Text',
        type: 'string',
        required: false,
        maxLength: 120,
        helpText: 'Your call-to-action, e.g. "Apply now at careers.example.com 🚀".',
      },
    ],
  },
  prompting: {
    systemPromptTemplate:
      'You are a creative director producing a recruiting Instagram carousel. ' +
      'Each slide should look professional, clean, and on-brand. ' +
      'Use consistent lighting, typography placement, and brand colors across all slides.',
    fixedCarousel: {
      itemFieldKeys: ['jobTitles', 'jobLocations'],
      itemLogoFieldKey: null,
      hookLogoFieldKey: 'logoUrl',
      maxItems: 10,

      hookPromptTemplate:
        'Clean professional recruiting poster for {{Brand Name}}. ' +
        'Bold headline text: "We\'re Hiring!" centered on a dark studio background. ' +
        'Company logo visible in the top-left corner. ' +
        'Subtle abstract geometric shapes in brand accent colors. ' +
        '9:16 vertical format, photorealistic, no watermarks.',

      itemPromptTemplate:
        'Minimal recruiting slide for {{Brand Name}}. ' +
        'Bold text overlay: "{{Job Titles}}" as the role title. ' +
        'Subtitle text: "{{Job Locations}}" beneath the title. ' +
        'Dark background, consistent typographic layout, professional and modern. ' +
        '9:16 vertical, clean and elegant, no watermarks.',

      ctaPromptTemplate:
        'Closing recruiting slide for {{Brand Name}}. ' +
        'Bold centered text: "{{CTA Text}}" on a dark gradient background. ' +
        'Subtle brand accent glow behind the text. ' +
        '9:16 vertical, polished finish, no watermarks.',

      footerText: 'DM us or visit our careers page to apply.',
    },
  },
};

// ---------------------------------------------------------------------------
// Role Reveal Carousel
// ---------------------------------------------------------------------------
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
          "One direct image URL per line (same order as Job Roles). Each photo is used as the face reference for that person's role slide.",
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
      itemFieldKeys: ['jobRoles', 'faceImages'],
      itemLogoFieldKey: 'faceImages',
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

// ---------------------------------------------------------------------------
// All seed definitions in insertion order
// ---------------------------------------------------------------------------
export const SEED_CONTENT_TYPES = [JOB_OPENINGS_CAROUSEL, ROLE_REVEAL_CAROUSEL];

/**
 * Inserts any seed content types that are not yet present in Supabase.
 * Idempotent — safe to call on every server-side render.
 * Returns the list of names that were newly inserted.
 */
export async function ensureContentTypesSeeded(): Promise<string[]> {
  const names = SEED_CONTENT_TYPES.map((ct) => ct.name);

  const { data: existing } = await supabaseAdmin
    .from('content_types')
    .select('name')
    .in('name', names);

  const existingNames = new Set((existing ?? []).map((r: any) => r.name));
  const toInsert = SEED_CONTENT_TYPES.filter((ct) => !existingNames.has(ct.name));

  if (toInsert.length === 0) return [];

  const { data: inserted, error } = await supabaseAdmin
    .from('content_types')
    .insert(toInsert)
    .select('name');

  if (error) {
    console.error('[seedData] Failed to insert content types:', error.message);
    return [];
  }

  return (inserted ?? []).map((r: any) => r.name);
}
