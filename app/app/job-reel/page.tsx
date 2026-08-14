import JobReelWizard from '@/components/job-reel/JobReelWizard';

export const dynamic = 'force-dynamic';

/**
 * Job Reel is fully self-contained: the draft lives in the browser
 * (localStorage), the background streams from Pinterest's CDN, and the
 * rendered video lands in Vercel Blob. No database anywhere on this path.
 */
export default function JobReelPage() {
  return <JobReelWizard />;
}
