import { NextRequest, NextResponse } from 'next/server';
import {
  TOWER_EXPERIENCE_BANDS,
  fetchTowerJobs,
  type TowerExperienceBand,
  type TowerJob,
} from '@/lib/towerClient';
import { buildUploadPath, uploadPublicFile } from '@/lib/storage';
import { MAX_JOB_CARDS } from '@/lib/jobReel';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Mirror a company logo into local uploads at reel-creation time
 * (contract §2.2: remote LinkedIn CDN URLs rot, and remote images would
 * taint the overlay canvas anyway). Returns null when the logo can't be
 * fetched — the card falls back to the company name text box.
 */
async function mirrorLogo(job: TowerJob): Promise<string | null> {
  if (!job.company_logo_url) return null;
  try {
    const response = await fetch(job.company_logo_url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) return null;
    const safeCompany = job.company_name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'logo';
    return await uploadPublicFile({
      path: buildUploadPath('job-reel/logos', `${safeCompany}.png`),
      body: buffer,
      contentType: response.headers.get('content-type') || 'image/png',
    });
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

    const logoUrls = await Promise.all(data.jobs.map((job) => mirrorLogo(job)));

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
