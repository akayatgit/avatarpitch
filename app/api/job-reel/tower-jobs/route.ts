import { NextRequest, NextResponse } from 'next/server';
import {
  TOWER_EXPERIENCE_BANDS,
  fetchTowerJobs,
  type TowerExperienceBand,
  type TowerJob,
} from '@/lib/towerClient';
import { MAX_JOB_CARDS } from '@/lib/jobReel';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_LOGO_BYTES = 200 * 1024;

/**
 * Fetch a company logo server-side and hand it to the client as a small data
 * URL (contract §2.2: remote CDN URLs rot, and remote images would taint the
 * overlay canvas — data URLs don't). No storage involved. Returns null when
 * the logo can't be fetched — the card falls back to the company name box.
 */
async function fetchLogoDataUrl(job: TowerJob): Promise<string | null> {
  if (!job.company_logo_url) return null;
  try {
    const response = await fetch(job.company_logo_url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100 || buffer.length > MAX_LOGO_BYTES) return null;
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Proxy to the Watch Tower partner API. Keeps the bearer token server-side
 * and returns rows mapped to job-card fields VERBATIM (tower law §4: no
 * model may author or embellish job facts).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const skill = searchParams.get('skill') ?? undefined;
    const experienceRaw = searchParams.get('experience') ?? undefined;
    const experience = (TOWER_EXPERIENCE_BANDS as readonly string[]).includes(experienceRaw ?? '')
      ? (experienceRaw as TowerExperienceBand)
      : undefined;
    const limitRaw = Number(searchParams.get('limit') ?? 6);
    const limit = Math.min(MAX_JOB_CARDS, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 6));

    const data = await fetchTowerJobs({
      skill,
      experience,
      freshDays: 7,
      requireLogo: false,
      onePerCompany: true,
      limit,
    });

    const logoUrls = await Promise.all(data.jobs.map((job) => fetchLogoDataUrl(job)));

    // Verbatim mapping — job facts straight from the tower response
    const cards = data.jobs.map((job, index) => ({
      towerJobId: job.id,
      company: job.company_name,
      logoUrl: logoUrls[index],
      role: job.role_title,
      experience: job.experience_text ?? job.experience_band ?? '',
      education: (job.education ?? []).join(', '),
      applyUrl: job.apply_url,
      postedAt: job.posted_at,
    }));

    return NextResponse.json({
      success: true,
      cards,
      totalMatched: data.total_matched,
      generatedAt: data.generated_at,
    });
  } catch (error) {
    console.error('Tower jobs proxy error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not reach the Watch Tower jobs API',
      },
      { status: 502 }
    );
  }
}
