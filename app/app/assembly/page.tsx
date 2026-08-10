import { supabaseAdmin } from '@/lib/supabaseAdmin';
import AssemblyWizard, { type RecentAssemblyProject } from '@/components/assembly/AssemblyWizard';
import { AssemblyStateSchema, ASSEMBLY_FORMAT, type AssemblyState } from '@/lib/assembly';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseAssemblyState(rawOutput: unknown): AssemblyState | null {
  try {
    const output = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (!output || (output as any).format !== ASSEMBLY_FORMAT) return null;
    const result = AssemblyStateSchema.safeParse(output);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export default async function AssemblyPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  let initialProjectId: string | null = null;
  let initialState: AssemblyState | null = null;
  let recentProjects: RecentAssemblyProject[] = [];

  // Load the requested project (resume flow)
  if (searchParams?.projectId) {
    try {
      const { data } = await supabaseAdmin
        .from('content_creation_requests')
        .select('id, generated_output')
        .eq('id', searchParams.projectId)
        .single();

      const state = data ? parseAssemblyState(data.generated_output) : null;
      if (data && state) {
        initialProjectId = data.id;
        initialState = state;
      }
    } catch (error) {
      console.error('Failed to load assembly project:', error);
    }
  }

  // Recent assembly projects for the landing screen
  try {
    const { data } = await supabaseAdmin
      .from('content_creation_requests')
      .select('id, generated_output, created_at')
      .eq('generated_output->>format', ASSEMBLY_FORMAT)
      .order('created_at', { ascending: false })
      .limit(8);

    recentProjects = (data ?? [])
      .map((row: { id: string; generated_output: unknown; created_at: string }) => {
        const state = parseAssemblyState(row.generated_output);
        if (!state) return null;
        return {
          id: row.id as string,
          title: state.title,
          createdAt: row.created_at as string,
          buildingCount: state.buildings.length,
          hasVideo: state.buildings.some((building) => Boolean(building.videoUrl)),
        };
      })
      .filter(
        (project: RecentAssemblyProject | null): project is RecentAssemblyProject =>
          project !== null
      );
  } catch (error) {
    console.error('Failed to load recent assembly projects:', error);
  }

  return (
    <AssemblyWizard
      key={initialProjectId ?? 'new'}
      initialProjectId={initialProjectId}
      initialState={initialState}
      recentProjects={recentProjects}
    />
  );
}
