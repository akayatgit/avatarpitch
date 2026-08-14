import { z } from 'zod';

export const JOB_REEL_FORMAT = 'jobreel_v1' as const;

/** Fixed output size — 9:16 vertical reel. */
export const JOB_REEL_WIDTH = 720;
export const JOB_REEL_HEIGHT = 1280;
export const JOB_REEL_FPS = 24;

export const MAX_JOB_CARDS = 12;
export const MIN_SECTION_SECONDS = 2;
export const MAX_SECTION_SECONDS = 10;

/** Section 1 — hook overlay (top to bottom: banner, headline, subtitle, hint). */
export const JobReelHookSchema = z.object({
  banner: z.string(),
  headline: z.string(),
  subtitle: z.string(),
  hint: z.string(),
});

export type JobReelHook = z.infer<typeof JobReelHookSchema>;

/** Sections 2..N — one uniform job card per company. */
export const JobReelCardSchema = z.object({
  id: z.string(),
  company: z.string(),
  logoUrl: z.string().nullable(),
  role: z.string(),
  experience: z.string(),
  education: z.string(),
  /** Optional per-section background (falls back to the default background). */
  backgroundUrl: z.string().nullable().default(null),
  backgroundType: z.enum(['video', 'image']).nullable().default(null),
});

export type JobReelCard = z.infer<typeof JobReelCardSchema>;

/** Final section — like/follow/comment CTA. All lines editable. */
export const JobReelCtaSchema = z.object({
  enabled: z.boolean().default(true),
  line1: z.string().default('Like, Follow & Comment for links'),
  line2: z.string().default('Join our Instagram channel for instant alerts'),
  line3: z.string().default('Channel link in bio'),
  durationSec: z.number().min(2).max(10).default(3),
  backgroundUrl: z.string().nullable().default(null),
  backgroundType: z.enum(['video', 'image']).nullable().default(null),
});

export type JobReelCta = z.infer<typeof JobReelCtaSchema>;

export const JOB_REEL_RENDER_STATUSES = ['idle', 'rendering', 'completed', 'failed'] as const;
export type JobReelRenderStatus = (typeof JOB_REEL_RENDER_STATUSES)[number];

/** Full state of a job reel draft — persisted in the browser (localStorage). */
export const JobReelStateSchema = z.object({
  format: z.literal(JOB_REEL_FORMAT),
  /** Original pasted Pinterest URL (kept so the background can be re-resolved). */
  backgroundSourceUrl: z.string(),
  /** Direct Pinterest CDN media URL (no re-hosting; render downloads from it). */
  backgroundUrl: z.string().nullable(),
  backgroundType: z.enum(['video', 'image']).nullable(),
  hook: JobReelHookSchema,
  /** Optional hook-section background (falls back to the default background). */
  hookBackgroundUrl: z.string().nullable().default(null),
  hookBackgroundType: z.enum(['video', 'image']).nullable().default(null),
  /** Staged reveal: banner+headline at 0s, subtitle+hint from this second. */
  hookRevealSec: z.number().min(0.5).max(9).default(1.5),
  cards: z.array(JobReelCardSchema).min(1).max(MAX_JOB_CARDS),
  cta: JobReelCtaSchema.default({}),
  hookDurationSec: z.number().min(MIN_SECTION_SECONDS).max(MAX_SECTION_SECONDS),
  cardDurationSec: z.number().min(MIN_SECTION_SECONDS).max(MAX_SECTION_SECONDS),
  renderStatus: z.enum(JOB_REEL_RENDER_STATUSES).default('idle'),
  renderError: z.string().nullable().default(null),
  /** ISO timestamp — used to detect renders that died without reporting back. */
  renderStartedAt: z.string().nullable().default(null),
  /** Server-side render ticket — lets the status poll survive reloads/app switches. */
  renderTicket: z.string().nullable().default(null),
  finalVideoUrl: z.string().nullable().default(null),
  step: z.number().int().min(1).max(4),
});

export type JobReelState = z.infer<typeof JobReelStateSchema>;

/** A render started this long ago with no result is considered dead. */
export const RENDER_STALE_AFTER_MS = 10 * 60 * 1000;

export function isRenderStale(state: Pick<JobReelState, 'renderStatus' | 'renderStartedAt'>): boolean {
  if (state.renderStatus !== 'rendering') return false;
  if (!state.renderStartedAt) return true;
  const startedAt = Date.parse(state.renderStartedAt);
  return !Number.isFinite(startedAt) || Date.now() - startedAt > RENDER_STALE_AFTER_MS;
}

export function createJobReelCard(): JobReelCard {
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    company: '',
    logoUrl: null,
    role: '',
    experience: '',
    education: '',
    backgroundUrl: null,
    backgroundType: null,
  };
}

export function duplicateJobReelCard(card: JobReelCard): JobReelCard {
  return { ...card, id: createJobReelCard().id };
}

export function createEmptyJobReelState(): JobReelState {
  return {
    format: JOB_REEL_FORMAT,
    backgroundSourceUrl: '',
    backgroundUrl: null,
    backgroundType: null,
    hook: {
      banner: '🚨Stop Scrolling🚨',
      headline: 'Know SQL?',
      subtitle: 'These companies are actively hiring candidates like you right now.',
      hint: '0-2 yrs exp',
    },
    hookBackgroundUrl: null,
    hookBackgroundType: null,
    hookRevealSec: 1.5,
    cards: [createJobReelCard()],
    cta: JobReelCtaSchema.parse({}),
    hookDurationSec: 3,
    cardDurationSec: 3,
    renderStatus: 'idle',
    renderError: null,
    renderStartedAt: null,
    renderTicket: null,
    finalVideoUrl: null,
    step: 1,
  };
}

/** Cards that have enough content to become a section in the final video. */
export function usableCards(state: JobReelState): JobReelCard[] {
  return state.cards.filter(
    (card) =>
      card.company.trim() ||
      card.role.trim() ||
      card.experience.trim() ||
      card.education.trim() ||
      card.logoUrl
  );
}

export function totalDurationSec(state: JobReelState): number {
  return (
    state.hookDurationSec +
    usableCards(state).length * state.cardDurationSec +
    (state.cta.enabled ? state.cta.durationSec : 0)
  );
}

/** Project title shown in lists — derived from the hook headline. */
export function jobReelTitle(state: JobReelState): string {
  return state.hook.headline.trim() || 'Job Reel';
}
