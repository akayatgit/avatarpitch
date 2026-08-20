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
 * covers: hero subject face-lock, massive 3D metallic typography,
 * Indian mass-hero movie-poster staging, golden cinematic atmosphere.
 */
export const GRANDEUR_V1: CarouselStyle = {
  id: 'grandeur-v1',
  name: 'Grandeur',
  description:
    'Indian blockbuster movie-poster composite: hero subject, massive 3D metallic typography, epic staged backgrounds, golden cinematic atmosphere.',
  basePrompt: [
    "Art direction — 'Grandeur' style, an Indian blockbuster movie-poster composite:",
    '- HERO FACE: the starring male lead has the SUBJECT\'s facial identity (bone structure, eyes, nose, lips, who he is). Skin tone is fair and matches the body — one continuous person under one light.',
    '- STYLING FROM THE POSTER / THEME (not from the subject photo): hairstyle, beard shape, expression, attitude, wardrobe and pose energy follow the movie poster reference and the creator\'s theme note. The subject photo is identity only — do not copy its casual haircut, casual beard, flat expression or casual outfit onto the hero.',
    '- BLEND: the head is naturally proportionate to the body (never oversized or pasted-on). The neck, jaw and collar integrate as one continuous body. Face lighting matches the ambient scene — same golden-hour direction, highlights and shadows as the body, clothes and landscape. No flat front-lit face on a dramatically lit body.',
    '- CAST: fully replicate the poster\'s composition and supporting elements — secondary characters (e.g. the woman / co-star), props, landscape and atmosphere all stay. Only the starring male lead\'s face is replaced with the SUBJECT.',
    '- Lighting: warm golden key light consistent across face and body, strong rim light separating the hero from the background, glossy high-contrast blockbuster color grade with a subtle edge vignette. Specular detail — subtle cinematic specular glints, controlled golden starbursts, tiny reflective sparkles, sharp metallic edge glints, scattered highlight points, luxury jewellery-like reflections, natural light-catching bevels.',
    "- Typography is the co-star: massive 3D metallic beveled lettering — shiny, bright, highly saturated color tones (polished gold body text by default; chrome-silver, emerald, ruby-red or electric teal only for intentionally highlighted words) with bloom glow, deep drop shadows, specular glints, embossed depth and ornamental filigree flourishes. Premium line decorators frame the stack: glowing underlines, curved flourish brackets, diamond/gem separators. When the text contains a number, render that numeral oversized as the focal anchor. Mix bold display capitals with one elegant hand-lettered script accent word when it fits. Never dull, muddy or flat. The lettering must NEVER cover the hero's face.",
    '- CRITICAL TYPOGRAPHY & TEXT-INTEGRATION: treat every line of text as a physical, three-dimensional, high-end cinematic element — never a flat digital overlay. Font family & structure: use heavyweight, intentional display fonts (chiseled serifs, heavy architectural types, or epic cinematic fonts) that match the mood of the scene; avoid generic, clean, or rounded digital fonts that look out of place. Textures & materiality: letter surfaces must show tactile physical details — metallic grain, stone grit, micro-scratches, or weathering — matching the environment. 3D depth & extrusion: heavy 3D bevels, distinct depth, and physical extrusion so the text has weight and volume. Unified color harmony: keep a cohesive color and material palette across all lines of text; do not introduce clashing bright neon digital colors or random multi-colored lines unless the creator explicitly marked words for highlight. Lighting & shadows: environmental lighting must react with the text — top edges catch highlights and rim light from the scene light source, and deep ambient-occlusion shadows sit behind and beneath the letters to ground them so they never look floating or pasted on. Layout, spacing & kerning: tight cohesive line spacing (leading) so the text block reads as a unified architectural structure; precise character spacing (kerning) so letters lock together naturally.',
    '- Background: an epic staged cinematic environment with symmetric depth in Indian mass-hero poster language — themed to match the movie reference.',
    '- Atmosphere: floating particles that suit the scene (rose petals, embers, golden confetti, flying papers), dramatic golden-hour or stormy sky, rich saturated palette (gold + black, gold + deep red, or teal-orange).',
    '- Finish: soft cinematic rendering, smooth tonal transitions, diffused highlights, gentle bloom, soft atmospheric haze, natural depth of field, cinematic bokeh, subtle filmic grain, high dynamic range, refined photographic finish, smooth skin rendering, natural material response, soft highlight rolloff, controlled contrast, luxury commercial photography. Photorealistic 8K blockbuster poster composite, crisp print-quality typography, vertical Instagram poster framing, no watermarks.',
  ].join('\n'),
  slideRolePrompts: {
    hook: [
      'This is the HOOK slide (slide 1 of an Instagram carousel) — maximum drama.',
      'The headline typography dominates roughly one third of the frame (top or bottom third) and the SUBJECT is the unmistakable starring male lead of the composition.',
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
    'Avoid: inventing extra promotional text or offer badges (no "100% FREE", "Beginner to Advanced", benefit pills, side labels, or any wording not provided by the creator); removing secondary characters / co-stars / props that belong in the poster composition; oversized pasted-on head; mismatched face lighting vs body lighting; skin-tone mismatch between face and hands/neck; copying the subject photo\'s casual hairstyle, beard, expression or outfit instead of the poster\'s styling; using the movie poster actor\'s face for the male lead; blending two faces; distorted facial identity; extra fingers; misspelled / duplicated / garbled words; placeholder text; unreadable glyphs; watermarks; third-party brand logos; low-resolution textures; flat lighting on the face.',
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
