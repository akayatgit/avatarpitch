import { supabaseAdmin } from '@/lib/supabaseAdmin';
import StudioWizard, { type RecentStudioProject } from '@/components/studio/StudioWizard';
import { StudioStateSchema, STUDIO_FORMAT, type StudioState } from '@/lib/studio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseStudioState(rawOutput: unknown): StudioState | null {
  try {
    const output = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (!output || (output as any).format !== STUDIO_FORMAT) return null;
    const result = StudioStateSchema.safeParse(output);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  let initialProjectId: string | null = null;
  let initialState: StudioState | null = null;
  let recentProjects: RecentStudioProject[] = [];

  // Load the requested project (resume flow)
  if (searchParams?.projectId) {
    try {
      const { data } = await supabaseAdmin
        .from('content_creation_requests')
        .select('id, generated_output')
        .eq('id', searchParams.projectId)
        .single();

      const state = data ? parseStudioState(data.generated_output) : null;
      if (data && state) {
        initialProjectId = data.id;
        initialState = state;
      }
    } catch (error) {
      console.error('Failed to load studio project:', error);
    }
  }

  // Recent studio projects for the landing screen
  try {
    const { data } = await supabaseAdmin
      .from('content_creation_requests')
      .select('id, generated_output, created_at')
      .eq('generated_output->>format', STUDIO_FORMAT)
      .order('created_at', { ascending: false })
      .limit(8);

    recentProjects = (data ?? [])
      .map((row: { id: string; generated_output: unknown; created_at: string }) => {
        const state = parseStudioState(row.generated_output);
        if (!state) return null;
        return {
          id: row.id as string,
          title: state.title,
          createdAt: row.created_at as string,
          sceneCount: state.scenes.length,
          hasVideo: state.scenes.some((scene) => Boolean(scene.videoUrl)),
        };
      })
      .filter((project: RecentStudioProject | null): project is RecentStudioProject => project !== null);
  } catch (error) {
    console.error('Failed to load recent studio projects:', error);
  }

  return (
    <StudioWizard
      key={initialProjectId ?? 'new'}
      initialProjectId={initialProjectId}
      initialState={initialState}
      recentProjects={recentProjects}
    />
  );
}
