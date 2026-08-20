/**
 * Carousel poster styles — the visual DNA used by the Carousel Maker.
 *
 * A style captures what stays constant across every generated slide; the
 * per-slide theme (movie poster reference + creator note) restyles wardrobe,
 * palette and environment on top of it. New trend styles are added here
 * without touching the UI.
 */

export type CarouselSlideRole = 'hook' | 'content' | 'cta';

export interface CarouselStyle {
  id: string;
  name: string;
  description: string;
  /** Common visual DNA shared by every slide of a carousel. */
  basePrompt: string;
  /** Composition directives per slide role. */
  slideRolePrompts: Record<CarouselSlideRole, string>;
  /** Failure modes the model must avoid. */
  negativeCues: string;
}

/**
 * Grandeur v1 — distilled from the reference set of competitor carousel
 * covers: one consistent hero subject, massive 3D metallic typography,
 * Indian mass-hero movie-poster staging, golden cinematic atmosphere.
 */
export const GRANDEUR_V1: CarouselStyle = {
  id: 'grandeur-v1',
  name: 'Grandeur',
  description:
    'Indian blockbuster movie-poster composite: hero subject, massive 3D metallic typography, epic staged backgrounds, golden cinematic atmosphere.',
  basePrompt: [
    "Art direction — 'Grandeur' style, an Indian blockbuster movie-poster composite:",
    "- The SUBJECT is rendered as a cinematic Indian movie star with the IDENTICAL face from the subject reference image — do not alter facial identity, structure, skin tone or beard shape. Groomed beard, styled voluminous hair, confident lead-actor pose, wardrobe styled like a film hero.",
    '- Lighting: warm golden key light on the face, strong rim light separating the subject from the background, glossy high-contrast blockbuster color grade with a subtle edge vignette.',
    "- Typography is the co-star: massive 3D metallic beveled lettering (polished gold by default; chrome-steel or emerald when the theme calls for it) with specular glints, embossed depth and ornamental filigree flourishes. When the text contains a number, render that numeral oversized as the focal anchor. Mix bold display capitals with one elegant hand-lettered script accent word. The lettering must NEVER cover the subject's face.",
    '- Background: an epic staged cinematic environment with symmetric depth in Indian mass-hero poster language — rows of repeated background figures, palace steps, sunset fields, rooftops, ornate interiors or city skylines — themed to match the movie reference.',
    '- Atmosphere: floating particles that suit the scene (rose petals, embers, golden confetti, flying papers), dramatic golden-hour or stormy sky, rich saturated palette (gold + black, gold + deep red, or teal-orange).',
    '- Finish: photorealistic 8K blockbuster poster composite, crisp print-quality typography, vertical Instagram poster framing, no watermarks.',
  ].join('\n'),
  slideRolePrompts: {
    hook: [
      'This is the HOOK slide (slide 1 of an Instagram carousel) — maximum drama.',
      'The headline typography dominates roughly one third of the frame (top or bottom third) and the subject is the unmistakable hero of the composition.',
      "Add a small elegant hand-written script 'Swipe →' cue at the bottom-center.",
      'Do NOT invent extra promotional copy — no offer badges, no benefit pills, no side labels like "100% FREE" or "Beginner to Advanced". Only render the exact text the creator provided.',
    ].join(' '),
    content: [
      'This is a CONTENT slide (middle of an Instagram carousel) — same art direction, but readability comes first.',
      'Render the slide text as a clean elegant content panel (numbered list or short lines) in refined metallic or cream lettering over a darkened area of the scene.',
      'The subject appears smaller or off to one side so the information owns the frame.',
      "Add a small script 'Swipe →' cue at the bottom-center.",
    ].join(' '),
    cta: [
      'This is the FINAL CTA slide of an Instagram carousel.',
      'The subject faces the camera directly with a warm, confident, welcoming expression.',
      'The CTA text is the metallic headline of the frame.',
      'Add one subtle glowing accent reinforcing the action — a golden check badge or a small gold-outlined pill badge.',
      "Do NOT add a 'Swipe' cue.",
    ].join(' '),
  },
  negativeCues:
    'Avoid: inventing extra promotional text or offer badges (no "100% FREE", "Beginner to Advanced", benefit pills, side labels, or any wording not provided by the creator), using the movie poster actor\'s face or any celebrity face for the hero, blending two faces together, distorted or altered facial identity, extra fingers, misspelled / duplicated / garbled words, placeholder text, unreadable glyphs, watermarks, third-party brand logos, low-resolution textures, flat lighting.',
};

const STYLE_REGISTRY: Record<string, CarouselStyle> = {
  [GRANDEUR_V1.id]: GRANDEUR_V1,
};

export const DEFAULT_CAROUSEL_STYLE_ID = GRANDEUR_V1.id;

export function getCarouselStyle(styleId: string): CarouselStyle {
  return STYLE_REGISTRY[styleId] ?? GRANDEUR_V1;
}

export function listCarouselStyles(): CarouselStyle[] {
  return Object.values(STYLE_REGISTRY);
}
