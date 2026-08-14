import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DroneTracingShotStudio, {
  type RecentDroneShotProject,
} from '@/components/workflows/drone-tracing-shot/DroneTracingShotStudio';
import { DroneShotStateSchema, DRONE_SHOT_FORMAT, type DroneShotState } from '@/lib/droneShot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDroneShotState(rawOutput: unknown): DroneShotState | null {
  try {
    const output = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (!output || (output as any).format !== DRONE_SHOT_FORMAT) return null;
    const result = DroneShotStateSchema.safeParse(output);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export default async function DroneShotPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  let initialProjectId: string | null = null;
  let initialState: DroneShotState | null = null;
  let recentProjects: RecentDroneShotProject[] = [];

  // Load the requested project (resume flow)
  if (searchParams?.projectId) {
    try {
      const { data } = await supabaseAdmin
        .from('content_creation_requests')
        .select('id, generated_output')
        .eq('id', searchParams.projectId)
        .single();

      const state = data ? parseDroneShotState(data.generated_output) : null;
      if (data && state) {
        initialProjectId = data.id;
        initialState = state;
      }
    } catch (error) {
      console.error('Failed to load drone shot project:', error);
    }
  }

  // Recent drone shot projects for the landing screen
  try {
    const { data } = await supabaseAdmin
      .from('content_creation_requests')
      .select('id, generated_output, created_at')
      .eq('generated_output->>format', DRONE_SHOT_FORMAT)
      .order('created_at', { ascending: false })
      .limit(8);

    recentProjects = (data ?? [])
      .map((row: { id: string; generated_output: unknown; created_at: string }) => {
        const state = parseDroneShotState(row.generated_output);
        if (!state) return null;
        return {
          id: row.id as string,
          title: state.ideation?.suggestion.title ?? 'Drone shot',
          createdAt: row.created_at as string,
          hasVideo: Boolean(state.videoUrl),
        };
      })
      .filter(
        (project: RecentDroneShotProject | null): project is RecentDroneShotProject =>
          project !== null
      );
  } catch (error) {
    console.error('Failed to load recent drone shot projects:', error);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
      <DroneTracingShotStudio
        key={initialProjectId ?? 'new'}
        initialProjectId={initialProjectId}
        initialState={initialState}
        recentProjects={recentProjects}
      />
    </div>
  );
}
