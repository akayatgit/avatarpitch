import { z } from 'zod';
import {
  DEFAULT_CAROUSEL_STYLE_ID,
  getCarouselStyle,
  type CarouselSlideRole,
  type CarouselStyle,
} from '@/lib/styles/grandeur';

export const CAROUSEL_MAKER_FORMAT = 'carouselmaker_v1' as const;

/** Instagram portrait — matches the reference posters. */
export const CAROUSEL_ASPECT_RATIO = '4:5' as const;

export const MIN_CONTENT_SLIDES = 1;
export const MAX_CONTENT_SLIDES = 8;
export const MAX_REFERENCE_IMAGES = 6;
export const MAX_GENERATIONS_PER_SLIDE = 12;

export const SlideGenerationSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

export type SlideGeneration = z.infer<typeof SlideGenerationSchema>;

export const CarouselSlideSchema = z.object({
  id: z.string(),
  role: z.enum(['hook', 'content', 'cta']),
  /** Exact text the model must render on the poster. */
  text: z.string().default(''),
  /** Creator's theme direction (e.g. "Jailer mass intro, red & gold"). */
  themeNote: z.string().default(''),
  /** Kollywood movie-poster reference image(s) — the theme key. */
  movieRefImageUrls: z.array(z.string()).default([]),
  /** Additional references added while iterating. */
  extraRefImageUrls: z.array(z.string()).default([]),
  generations: z.array(SlideGenerationSchema).default([]),
  selectedGenerationId: z.string().nullable().default(null),
});

export type CarouselSlide = z.infer<typeof CarouselSlideSchema>;

/** Full state of a carousel draft — persisted in the browser (localStorage). */
export const CarouselMakerStateSchema = z.object({
  format: z.literal(CAROUSEL_MAKER_FORMAT),
  styleId: z.string().default(DEFAULT_CAROUSEL_STYLE_ID),
  /** Photos of the creator — the face lock, shared by every slide. */
  subjectImageUrls: z.array(z.string()).default([]),
  /** How to spot the subject photo (e.g. "the man in the white round-neck t-shirt"). */
  subjectDescription: z.string().default(''),
  slides: z.array(CarouselSlideSchema).min(1),
  activeSlideId: z.string(),
});

export type CarouselMakerState = z.infer<typeof CarouselMakerStateSchema>;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCarouselSlide(role: CarouselSlideRole): CarouselSlide {
  return {
    id: newId(role),
    role,
    text:
      role === 'cta'
        ? 'Follow for daily job updates\nComment "JOBS" for the link'
        : '',
    themeNote: '',
    movieRefImageUrls: [],
    extraRefImageUrls: [],
    generations: [],
    selectedGenerationId: null,
  };
}

export function createEmptyCarouselState(): CarouselMakerState {
  const hook = createCarouselSlide('hook');
  const slides: CarouselSlide[] = [
    hook,
    createCarouselSlide('content'),
    createCarouselSlide('content'),
    createCarouselSlide('content'),
    createCarouselSlide('cta'),
  ];
  return {
    format: CAROUSEL_MAKER_FORMAT,
    styleId: DEFAULT_CAROUSEL_STYLE_ID,
    subjectImageUrls: [],
    subjectDescription: '',
    slides,
    activeSlideId: hook.id,
  };
}

/** Hook and CTA are fixed; content slides can be removed down to one. */
export function canDeleteSlide(state: CarouselMakerState, slideId: string): boolean {
  const slide = state.slides.find((entry) => entry.id === slideId);
  if (!slide || slide.role !== 'content') return false;
  return state.slides.filter((entry) => entry.role === 'content').length > MIN_CONTENT_SLIDES;
}

export function canAddContentSlide(state: CarouselMakerState): boolean {
  return state.slides.filter((entry) => entry.role === 'content').length < MAX_CONTENT_SLIDES;
}

export function slideLabel(state: CarouselMakerState, slideId: string): string {
  const slide = state.slides.find((entry) => entry.id === slideId);
  if (!slide) return '';
  if (slide.role === 'hook') return 'Hook';
  if (slide.role === 'cta') return 'CTA';
  const contentSlides = state.slides.filter((entry) => entry.role === 'content');
  const index = contentSlides.findIndex((entry) => entry.id === slideId);
  return `Slide ${index + 2}`;
}

export function selectedGeneration(slide: CarouselSlide): SlideGeneration | null {
  if (slide.generations.length === 0) return null;
  return (
    slide.generations.find((entry) => entry.id === slide.selectedGenerationId) ??
    slide.generations[slide.generations.length - 1]
  );
}

/** Everything the generation API needs for one slide. */
export interface ComposedSlidePrompt {
  prompt: string;
  /** Ordered: subject photos first, then movie refs, then extra refs. */
  referenceImageUrls: string[];
}

/**
 * Build the final Nano Banana Pro prompt for a slide:
 * role composition + base style DNA + exact text + theme + reference manifest.
 */
export function composeSlidePrompt(options: {
  style?: CarouselStyle;
  styleId?: string;
  slide: Pick<
    CarouselSlide,
    'role' | 'text' | 'themeNote' | 'movieRefImageUrls' | 'extraRefImageUrls'
  >;
  subjectImageUrls: string[];
  /** Visual description of the subject photo (e.g. "the man in the white round-neck t-shirt"). */
  subjectDescription?: string;
}): ComposedSlidePrompt {
  const { slide, subjectImageUrls } = options;
  const subjectDescription = options.subjectDescription?.trim() ?? '';
  const style = options.style ?? getCarouselStyle(options.styleId ?? DEFAULT_CAROUSEL_STYLE_ID);

  const referenceImageUrls = [
    ...subjectImageUrls,
    ...slide.movieRefImageUrls,
    ...slide.extraRefImageUrls,
  ].filter(Boolean);

  const subjectCount = subjectImageUrls.length;
  const movieCount = slide.movieRefImageUrls.length;
  const subjectRefLabel =
    subjectCount === 1 ? 'image 1' : `images 1–${subjectCount}`;
  const movieRefLabel =
    movieCount === 1
      ? `image ${subjectCount + 1}`
      : `images ${subjectCount + 1}–${subjectCount + movieCount}`;

  // Face identity is the #1 failure mode — casting must be the first and
  // loudest instruction. Index-only references ("image 1") are not reliable,
  // so the subject is also identified by appearance and by photo type.
  // Secondary characters from the poster MUST stay — only the male lead face swaps.
  const subjectIdentifier = subjectDescription
    ? `the SUBJECT is the person in the plain real-life photo — ${subjectDescription}`
    : 'the SUBJECT is the person in the plain real-life photo (an ordinary casual snapshot with NO title lettering, NO graphics, NO poster design)';

  const castingParts: string[] = [
    `CASTING — the most important rule of this task. Among the attached reference images, ${subjectIdentifier}. That photo is attached as ${subjectRefLabel}.`,
    `FACE IDENTITY ONLY: transplant the SUBJECT's facial identity onto the starring male lead — same bone structure, eyes, nose, lips and who he is. Skin tone must be fair and match the body (face, neck and hands are one continuous tone).`,
    `STYLING FROM THE POSTER / THEME — NOT from the subject photo: the hero's hairstyle, beard shape, expression, attitude, wardrobe and pose follow the movie poster reference and the creator's theme. Do NOT copy the subject photo's casual haircut, casual beard, flat expression or casual outfit.`,
    `BLEND: head size is naturally proportionate to the body — never oversized or pasted-on. Seamlessly integrate the neck and jaw with the collar. Face lighting MUST match the ambient scene (same golden-hour direction, highlights and shadows as the body, clothes and landscape). A flat front-lit face on a dramatically lit body is a failure.`,
  ];
  if (movieCount > 0) {
    castingParts.push(
      `COMPOSITION LOCK (${movieRefLabel} — the stylized poster with big title lettering): fully replicate the poster's scene, layout, supporting characters (keep the woman / co-star and every other figure), props, landscape and atmosphere. The original male lead actor's face is REPLACED by the SUBJECT — that is the only face change. Do NOT delete secondary characters to "make room" for the subject.`
    );
  }
  const castingBlock = castingParts.join('\n');

  const manifest: string[] = [];
  let refIndex = 1;
  for (let i = 0; i < subjectCount; i += 1) {
    manifest.push(
      `Reference image ${refIndex}: the SUBJECT${subjectDescription ? ` (${subjectDescription})` : ''} — FACE IDENTITY ONLY for the starring male lead (not hair, beard style, expression or outfit).`
    );
    refIndex += 1;
  }
  for (let i = 0; i < movieCount; i += 1) {
    manifest.push(
      `Reference image ${refIndex}: MOVIE / STYLE POSTER — replicate its full composition (including secondary characters and props); replace only the starring male lead's face with the SUBJECT; take hairstyle, beard, expression, attitude, wardrobe, palette and mood from this poster.`
    );
    refIndex += 1;
  }
  for (let i = 0; i < slide.extraRefImageUrls.length; i += 1) {
    manifest.push(
      `Reference image ${refIndex}: additional visual reference — incorporate its useful details (framing, lighting, props or texture) into the composition.`
    );
    refIndex += 1;
  }

  const textLines = slide.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const textBlock =
    textLines.length > 1
      ? `Render these exact lines as the poster text, spelled letter-for-letter perfectly:\n${textLines
          .map((line) => `"${line}"`)
          .join('\n')}`
      : `Render this exact text as the poster typography, spelled letter-for-letter perfectly: "${textLines[0] ?? ''}"`;

  const themeParts: string[] = [];
  if (movieCount > 0) {
    themeParts.push(
      `Replicate the MOVIE / STYLE POSTER composition (${movieRefLabel}) in full — scene, supporting characters, props, landscape — with the SUBJECT's face as the starring male lead. Hairstyle, beard, expression and attitude come from this poster and the theme, not from the subject photo.`
    );
  }
  if (slide.themeNote.trim()) {
    themeParts.push(`Theme direction from the creator: ${slide.themeNote.trim()}`);
  }

  const finalIdentityCheck = [
    `FINAL CHECK before you render:`,
    `1) Hero face = SUBJECT${subjectDescription ? ` (${subjectDescription})` : ''} — same person, not the poster actor.`,
    `2) Supporting characters from the poster are still present (do not delete the woman / co-star).`,
    `3) Head is proportionate and lighting/skin tone on the face matches the body and ambient golden-hour light.`,
    `4) Hairstyle, beard, expression and attitude match the poster/theme — not the casual subject photo.`,
    `If any check fails, the image is wrong.`,
  ].join(' ');

  const prompt = [
    castingBlock,
    style.slideRolePrompts[slide.role],
    style.basePrompt,
    textBlock,
    ...(themeParts.length > 0 ? [themeParts.join(' ')] : []),
    ...(manifest.length > 0 ? [manifest.join('\n')] : []),
    style.negativeCues,
    finalIdentityCheck,
  ].join('\n\n');

  return { prompt, referenceImageUrls };
}

/**
 * Second-pass prompt: the draft poster already has the right composition,
 * but Nano Banana tends to paste the selfie as-is. This pass forces a true
 * face integration — identity from subject, hair/beard/attitude from poster,
 * lighting matched to the scene.
 */
export function composeFaceBlendPrompt(options: {
  subjectDescription?: string;
  subjectCount: number;
  movieCount: number;
  themeNote?: string;
}): { prompt: string } {
  const subjectDescription = options.subjectDescription?.trim() ?? '';
  const subjectLabel =
    options.subjectCount <= 1
      ? 'image 2'
      : `images 2–${1 + options.subjectCount}`;
  const movieStart = 2 + options.subjectCount;
  const movieLabel =
    options.movieCount <= 0
      ? null
      : options.movieCount === 1
        ? `image ${movieStart}`
        : `images ${movieStart}–${movieStart + options.movieCount - 1}`;

  const subjectWho = subjectDescription
    ? `the SUBJECT (${subjectDescription}) in the plain real-life photo (${subjectLabel})`
    : `the SUBJECT in the plain real-life photo (${subjectLabel}) — ordinary casual snapshot, no poster graphics`;

  const restyleBlock = movieLabel
    ? `RESTYLE — the biggest failure to fix: the draft still shows the SUBJECT photo's hair, beard and expression as-is. That is wrong. Completely restyle the male lead's hairstyle, beard shape, expression and attitude to match the starring male lead in the STYLE POSTER (${movieLabel}). Keep only WHO he is from the subject photo — bone structure, eyes, nose, lips. The casual selfie haircut, selfie beard and flat selfie expression must be gone.`
    : `RESTYLE: give the male lead a cinematic movie-star hairstyle, beard and intense expression that fits the scene. Do NOT keep the casual selfie haircut, selfie beard or flat selfie expression.`;

  const themeLine = options.themeNote?.trim()
    ? `Theme direction: ${options.themeNote.trim()}.`
    : '';

  const prompt = [
    'FACE INTEGRATION PASS — edit the DRAFT POSTER (image 1). Keep the entire composition, typography, background, supporting characters, props, body pose and wardrobe EXACTLY as in image 1. You are only refining the starring male lead\'s head so it looks naturally shot in this scene — not pasted on.',
    `IDENTITY: the face must be ${subjectWho}. Same bone structure, eyes, nose, lips — the same person. Fair skin tone continuous from face through neck to the hands/arms already in image 1.`,
    restyleBlock,
    'RELIGHT: match the face to the ambient light of image 1. If the scene is fire / golden-hour / orange rim light, the face MUST pick up the same warm directional highlights, rim light and shadows as the body, clothes and environment. A flat, cool, selfie-lit face on a dramatically lit body is a failure.',
    'BLEND: resize the head to natural proportion with the body (never oversized). Seamlessly fuse the jaw and neck into the collar — no hard seam, no floating head, no pasted-on look.',
    themeLine,
    'Do not change the poster text. Do not invent offer badges. Do not remove supporting characters. Do not redesign the background.',
    'FINAL CHECK: if the hair/beard still look like the casual subject photo, or the face lighting does not match the body, the image is wrong — fix it.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { prompt };
}

/** A slide is ready to generate once there is text and a subject photo. */
export function slideGenerationBlockers(
  state: CarouselMakerState,
  slide: CarouselSlide
): string[] {
  const blockers: string[] = [];
  if (state.subjectImageUrls.length === 0) blockers.push('Add your subject photo');
  if (!slide.text.trim()) blockers.push('Write the slide text');
  return blockers;
}
