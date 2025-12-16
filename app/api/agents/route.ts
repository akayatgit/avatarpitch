import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Disable caching for API routes
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('id, name, role, system_prompt, prompt, temperature')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

