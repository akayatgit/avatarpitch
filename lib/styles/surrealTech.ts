/**
 * Shared visual-style presets for all workflows.
 * Aesthetic: minimalist surreal — one hero, one clean twist, noise-free (not crowded landscapes).
 */

export type SurrealStyleId =
  | 'surrealism'
  | 'hyperrealism-surrealism'
  | 'surrealism-impossible-geometry'
  | 'dreamcore-liminal'
  | 'magical-realism-hyperrealism'
  | 'fractals-psychedelic'
  | 'cosmic-surrealism-hyperrealism'
  | 'biomechanical-gothic'
  | 'glitch-surrealism'
  | 'impossible-architecture-escher'
  | 'uncanny-valley-hyperrealism';

export type ScaleMode = 'microscopic' | 'gigantic';

export interface SurrealStylePreset {
  id: SurrealStyleId;
  name: string;
  /** Short cue for LLMs / image suffix */
  visualCue: string;
}

export const SURREAL_STYLE_PRESETS: SurrealStylePreset[] = [
  {
    id: 'surrealism',
    name: 'Surrealism',
    visualCue:
      'Surrealist technology dreamscape — impossible computer-world logic rendered with dreamlike clarity, unexpected scale collisions, uncanny tech metaphors',
  },
  {
    id: 'hyperrealism-surrealism',
    name: 'Hyperrealism + Surrealism',
    visualCue:
      'Ultra-sharp hyperrealistic materials (silicon, metal, glass) in surreal impossible situations — photoreal textures, dream logic',
  },
  {
    id: 'surrealism-impossible-geometry',
    name: 'Surrealism + Impossible Geometry',
    visualCue:
      'Surreal tech world with impossible geometry — Escher-like chip architectures, recursive circuit canyons, non-Euclidean data landscapes',
  },
  {
    id: 'dreamcore-liminal',
    name: 'Dreamcore + Liminal Spaces',
    visualCue:
      'Dreamcore liminal technology spaces — endless empty server corridors at planetary scale, soft eerie light, nostalgic uncanny calm',
  },
  {
    id: 'magical-realism-hyperrealism',
    name: 'Magical Realism + Hyperrealism',
    visualCue:
      'Magical realism meets hyperreal tech — everyday programming objects behave like living miracles, photographic realism with wonder',
  },
  {
    id: 'fractals-psychedelic',
    name: 'Fractals + Psychedelic Art',
    visualCue:
      'Fractal psychedelic circuit art — recursive chip patterns, neon data veins, kaleidoscopic code aurora across vast landscapes',
  },
  {
    id: 'cosmic-surrealism-hyperrealism',
    name: 'Cosmic Surrealism + Hyperrealism',
    visualCue:
      'Cosmic surrealism + hyperreal silicon — planet-sized processors, nebulae of bytecode, orbital motherboards in deep space light',
  },
  {
    id: 'biomechanical-gothic',
    name: 'Biomechanical + Gothic',
    visualCue:
      'Biomechanical gothic computing — organic cables as cathedral ribs, dark chrome nerves, living machines in vast cathedral-scale landscapes',
  },
  {
    id: 'glitch-surrealism',
    name: 'Glitch Art + Surrealism',
    visualCue:
      'Glitch-art surrealism — digital tear artifacts, RGB splits, corrupted UI landscapes as physical terrain at epic scale',
  },
  {
    id: 'impossible-architecture-escher',
    name: 'Impossible Architecture + Escher Geometry',
    visualCue:
      'Impossible Escher architecture built from motherboards and server racks — staircases of RAM, paradoxical data centers spanning horizons',
  },
  {
    id: 'uncanny-valley-hyperrealism',
    name: 'Uncanny Valley + Hyperrealism',
    visualCue:
      'Uncanny-valley hyperreal tech beings and environments — almost-human interfaces, eerily perfect silicon flesh, uneasy photorealism',
  },
];

/**
 * House style for ALL suggestion / still generation:
 * like brain-mouse, giraffe+cloud, donkey+phone blinkers — one hero, one twist, lots of calm space.
 */
export const MINIMALIST_SURREAL_LOCK =
  'AESTHETIC LOCK (MANDATORY): Minimalist surreal, noise-free, mind-bending. ONE clear hero subject. ONE simple impossible twist. Large clean negative space or a flat/simple backdrop. Hyperreal materials, sparse composition. Think: brain shaped like a mouse on white; giraffe with one cloud around the neck; donkey with phones as blinkers; giant phone as a single monolith. NOT busy, NOT crowded, NOT collage, NOT max-detail cyber landscapes.';

export const FORBIDDEN_SLOP_LOCK =
  'FORBIDDEN: crowded scenes, floating debris fields, heat-sink skylines, PCB continents, chip canyons, neon data rivers as the whole image, particle storms, dense circuit wallpaper, multiple competing subjects, ornate over-detail, "epic establishing landscape" slop, abstract tech cities.';

/**
 * Optional scale as ONE twist on the same hero — never an excuse for a busy world.
 */
export const SCALE_LOCK =
  'SCALE (optional single twist): (A) microscopic material read on the SAME hero, or (B) the SAME hero slightly colossal — still one subject, still sparse. Never build a city/continent around it.';

export const TECH_THEME_LOCK =
  'TWIST RULE: Prefer exactly one clever tech/salary metaphor on the inspiration subjects (e.g. cash becomes a neat stack of chips; marble skin shows subtle silicon veins; sunglasses reflect code). Keep everything else calm and simple. Do not cover the frame in circuitry.';

export const SUBJECT_PRESERVE_LOCK =
  'SUBJECT LOCK (HIGHEST WEIGHT): Keep the inspiration hero(s) — same person/statue/object, pose, and framing family. If inspiration is a statue holding money on a purple field, output is still that statue-like figure with an analogous prop on a simple field. Background stays as simple as the inspiration (solid color, soft gradient, or minimal environment).';

export const AMATEUR_CAMERA_LOCK =
  'CAMERA FEEL: Clean intentional framing — stable, graphic, poster-like. Avoid frantic handheld shake that adds visual noise.';

export function getSurrealStyle(id: SurrealStyleId): SurrealStylePreset {
  return SURREAL_STYLE_PRESETS.find((s) => s.id === id) ?? SURREAL_STYLE_PRESETS[0];
}

/** Highest-weight lock when an inspiration (Pinterest) image is attached as reference. */
export const INSPIRATION_IMAGE_LOCK =
  'PRIMARY REFERENCE: Match the inspiration image\'s hero subjects, pose, simple backdrop, color grade, and quiet graphic composition. Add at most one surreal twist tied to the teaching topic. Never abandon the hero for an unrelated landscape.';

function scaleHintFor(scale?: ScaleMode): string {
  if (scale === 'microscopic') {
    return 'Optional twist: subtle microscopic chip/silicon material on the SAME hero only — portrait stays clean and sparse.';
  }
  if (scale === 'gigantic') {
    return 'Optional twist: same hero slightly monumental — still one figure, simple backdrop, no surrounding city/clutter.';
  }
  return SCALE_LOCK;
}

/** Append inspiration + minimalist surreal locks to an image prompt (use with reference image). */
export function applyInspirationImageLocks(basePrompt: string, scale?: ScaleMode): string {
  return [
    MINIMALIST_SURREAL_LOCK,
    SUBJECT_PRESERVE_LOCK,
    INSPIRATION_IMAGE_LOCK,
    FORBIDDEN_SLOP_LOCK,
    basePrompt.trim().replace(/\.?\s*$/, '.'),
    TECH_THEME_LOCK,
    scaleHintFor(scale),
    'Hyperreal, sparse, 9:16 vertical. No text, no logos, no watermarks. Maximum negative space. One hero. One twist.',
  ].join(' ');
}

/**
 * Refine a picked 720p draft into HQ.
 * Refs: [inspirationImage, draftImage] — inspiration locks subjects; draft guides the single twist.
 */
export function applyDraftRefineLocks(
  basePrompt: string,
  corrections: string,
  scale?: ScaleMode
): string {
  const fix = corrections.trim();
  return [
    MINIMALIST_SURREAL_LOCK,
    SUBJECT_PRESERVE_LOCK,
    FORBIDDEN_SLOP_LOCK,
    'INSPIRATION LOCK: First attached image = original inspiration — keep its hero and simple backdrop.',
    'DRAFT LOCK: Second attached image = chosen concept — keep its ONE twist only; remove any clutter that crept in.',
    basePrompt.trim().replace(/\.?\s*$/, '.'),
    fix
      ? `USER CORRECTIONS (apply precisely): ${fix.replace(/\.?\s*$/, '.')}`
      : 'No extra corrections — sharpen the hero; keep the frame sparse.',
    TECH_THEME_LOCK,
    scaleHintFor(scale),
    'High fidelity 9:16. Sparse. One hero. One twist. No text/watermarks.',
  ].join(' ');
}

/** @deprecated prefer applyInspirationImageLocks when a Pinterest/inspiration ref is present */
export function applySurrealImageLocks(
  basePrompt: string,
  _styleId: SurrealStyleId,
  scale?: ScaleMode
): string {
  return applyInspirationImageLocks(basePrompt, scale);
}

/** Style block injected into Seedance master prompts (inspiration-led). */
export function inspirationVideoStyleBlock(inspirationRead?: string): string {
  return [
    'Visual Style: Minimalist surreal — one hero, one twist, noise-free, match inspiration subjects and calm composition.',
    inspirationRead ? `Inspiration read: ${inspirationRead}` : '',
    MINIMALIST_SURREAL_LOCK,
    TECH_THEME_LOCK,
    FORBIDDEN_SLOP_LOCK,
    AMATEUR_CAMERA_LOCK,
  ]
    .filter(Boolean)
    .join('\n');
}

/** @deprecated use inspirationVideoStyleBlock */
export function surrealVideoStyleBlock(styleId: SurrealStyleId): string {
  const style = getSurrealStyle(styleId);
  return [
    `Visual Style Mix: ${style.name}`,
    style.visualCue,
    TECH_THEME_LOCK,
    SCALE_LOCK,
    AMATEUR_CAMERA_LOCK,
  ].join('\n');
}
