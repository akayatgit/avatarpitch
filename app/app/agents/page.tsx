import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createAgent, updateAgent, deleteAgent } from '../actions';
import AgentList from '@/components/AgentList';
import CollapsibleAgentForm from '@/components/CollapsibleAgentForm';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgentsPage() {
  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, role, system_prompt, prompt, temperature, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error && isSupabaseNetworkError(error)) {
    return <NetworkError message="Unable to load agents. Please check your internet connection." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Agents</h1>
        <p className="text-sm sm:text-base text-gray-400">
          Create and manage AI agents for your video generation workflows.
        </p>
      </div>

      <CollapsibleAgentForm createAgent={createAgent} />

      <div className="mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">All Agents</h2>
        <AgentList
          agents={agents || []}
          updateAgent={updateAgent}
          deleteAgent={deleteAgent}
        />
      </div>
    </div>
  );
}

