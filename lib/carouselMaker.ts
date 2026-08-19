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
}): ComposedSlidePrompt {
  const { slide, subjectImageUrls } = options;
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
  // loudest instruction, and the movie poster must be framed as style-only
  // with an explicit actor replacement order.
  const castingParts: string[] = [
    `CASTING — the most important rule of this task: the ONLY person allowed on this poster is the SUBJECT shown in ${subjectRefLabel}. Recreate the SUBJECT's face with photographic identity accuracy — same bone structure, eyes, nose, lips, skin tone, hairline and beard shape. This is a real person; do not beautify, blend or replace their face.`,
  ];
  if (movieCount > 0) {
    castingParts.push(
      `The MOVIE POSTER in ${movieRefLabel} is a STYLE reference ONLY. The actor in that poster must NOT appear in the output — completely REPLACE him with the SUBJECT from ${subjectRefLabel}, as if the SUBJECT starred in that movie. Take only the poster's wardrobe styling, color palette, environment, era, pose energy, typography treatment and mood. Any resemblance to the poster's original actor is a failure.`
    );
  }
  const castingBlock = castingParts.join('\n');

  const manifest: string[] = [];
  let refIndex = 1;
  for (let i = 0; i < subjectCount; i += 1) {
    manifest.push(
      `Reference image ${refIndex}: the SUBJECT — the one and only face allowed in the hero role.`
    );
    refIndex += 1;
  }
  for (let i = 0; i < movieCount; i += 1) {
    manifest.push(
      `Reference image ${refIndex}: MOVIE POSTER — style only; its actor is replaced by the SUBJECT.`
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
      `Restyle the entire composition in the visual language of the MOVIE POSTER reference (${movieRefLabel}): its wardrobe, palette, environment, era and mood — with the SUBJECT's face from ${subjectRefLabel} in the starring role.`
    );
  }
  if (slide.themeNote.trim()) {
    themeParts.push(`Theme direction from the creator: ${slide.themeNote.trim()}`);
  }

  const finalIdentityCheck = `FINAL CHECK before you render: compare the hero's face against ${subjectRefLabel}. It must be the SAME person — not the movie poster actor, not a lookalike, not a blend. If it is not the SUBJECT, the image is wrong.`;

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
