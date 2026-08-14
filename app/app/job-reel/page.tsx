import { supabaseAdmin } from '@/lib/supabaseAdmin';
import JobReelWizard, { type RecentJobReelProject } from '@/components/job-reel/JobReelWizard';
import { JOB_REEL_FORMAT, JobReelStateSchema, type JobReelState } from '@/lib/jobReel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseJobReelState(rawOutput: unknown): JobReelState | null {
  try {
    const output = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (!output || (output as any).format !== JOB_REEL_FORMAT) return null;
    const result = JobReelStateSchema.safeParse(output);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export default async function JobReelPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  let initialProjectId: string | null = null;
  let initialState: JobReelState | null = null;
  let recentProjects: RecentJobReelProject[] = [];

  // Load the requested project (resume flow — e.g. coming back for the download)
  if (searchParams?.projectId) {
    try {
      const { data } = await supabaseAdmin
        .from('content_creation_requests')
        .select('id, generated_output')
        .eq('id', searchParams.projectId)
        .single();

      const state = data ? parseJobReelState(data.generated_output) : null;
      if (data && state) {
        initialProjectId = data.id;
        initialState = state;
      }
    } catch (error) {
      console.error('Failed to load job reel project:', error);
    }
  }

  // Recent job reel projects for the landing screen
  try {
    const { data } = await supabaseAdmin
      .from('content_creation_requests')
      .select('id, generated_output, created_at')
      .eq('generated_output->>format', JOB_REEL_FORMAT)
      .order('created_at', { ascending: false })
      .limit(8);

    recentProjects = (data ?? [])
      .map((row: { id: string; generated_output: unknown; created_at: string }) => {
        const state = parseJobReelState(row.generated_output);
        if (!state) return null;
        return {
          id: row.id as string,
          title: state.hook.headline,
          createdAt: row.created_at as string,
          cardCount: state.cards.length,
          renderStatus: state.renderStatus,
          hasVideo: Boolean(state.finalVideoUrl),
        };
      })
      .filter(
        (project: RecentJobReelProject | null): project is RecentJobReelProject =>
          project !== null
      );
  } catch (error) {
    console.error('Failed to load recent job reel projects:', error);
  }

  return (
    <JobReelWizard
      key={initialProjectId ?? 'new'}
      initialProjectId={initialProjectId}
      initialState={initialState}
      recentProjects={recentProjects}
    />
  );
}
