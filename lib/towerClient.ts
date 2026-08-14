/**
 * Watch Tower partner API client — the ONLY door to tower job data
 * (contract §4: no Postgres connection exists for AvatarPitch; all query
 * logic, freshness rules, and dedupe live tower-side behind /api/partner/v1).
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001/api/partner/v1';
const REQUEST_TIMEOUT_MS = 10_000;

export const TOWER_EXPERIENCE_BANDS = [
  'fresher',
  '1-2',
  '3-5',
  '6-8',
  '9-12',
  '13plus',
] as const;
export type TowerExperienceBand = (typeof TOWER_EXPERIENCE_BANDS)[number];

export interface TowerJob {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  role_title: string;
  experience_min_months: number | null;
  experience_max_months: number | null;
  experience_text: string | null;
  experience_band: string | null;
  education: string[];
  certifications: string[];
  domains: string[];
  location: string | null;
  city: string | null;
  apply_url: string | null;
  source: string;
  track: string | null;
  posted_at: string | null;
  scraped_at: string | null;
}

export interface TowerJobsResponse {
  jobs: TowerJob[];
  total_matched: number;
  generated_at: string;
}

export interface TowerReelSuggestion {
  skill: string;
  active_jobs: number;
  companies_with_logo: number;
}

export interface TowerJobsParams {
  skill?: string;
  experience?: TowerExperienceBand;
  city?: string;
  freshDays?: number;
  requireLogo?: boolean;
  onePerCompany?: boolean;
  limit?: number;
}

function towerBaseUrl(): string {
  return (process.env.TOWER_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function towerFetch<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const token = process.env.PARTNER_API_TOKEN;
  if (!token) {
    throw new Error(
      'PARTNER_API_TOKEN is not set — ask Ashok to mirror the Watch Tower partner token into the AvatarPitch env.'
    );
  }

  const url = new URL(`${towerBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 401) {
      throw new Error('Watch Tower rejected the partner token (401) — check PARTNER_API_TOKEN.');
    }
    if (!response.ok) {
      throw new Error(`Watch Tower API error (${response.status})`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Watch Tower API did not respond — the tower may be deploying. Try again in a minute.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Contract §2.2 — job cards ready to render. */
export async function fetchTowerJobs(params: TowerJobsParams): Promise<TowerJobsResponse> {
  return towerFetch<TowerJobsResponse>('/jobs', {
    skill: params.skill?.trim().toLowerCase() || undefined,
    experience: params.experience,
    city: params.city,
    fresh_days: params.freshDays != null ? String(params.freshDays) : undefined,
    require_logo: params.requireLogo != null ? String(params.requireLogo) : undefined,
    one_per_company: params.onePerCompany != null ? String(params.onePerCompany) : undefined,
    limit: params.limit != null ? String(params.limit) : undefined,
  });
}

/** Contract §2.2 — which reels are worth making this week. */
export async function fetchTowerReelSuggestions(options?: {
  freshDays?: number;
  minJobs?: number;
  limit?: number;
}): Promise<{ suggestions: TowerReelSuggestion[]; generated_at: string }> {
  return towerFetch('/reel-suggestions', {
    fresh_days: options?.freshDays != null ? String(options.freshDays) : undefined,
    min_jobs: options?.minJobs != null ? String(options.minJobs) : undefined,
    limit: options?.limit != null ? String(options.limit) : undefined,
  });
}

/** Contract §2.2 — truthful "live data" indicator. */
export async function fetchTowerHealth(): Promise<{
  ok: boolean;
  jobs_total: number;
  freshest_scrape_at: string;
}> {
  return towerFetch('/health', {});
}
