import { createClient } from '@supabase/supabase-js';

// Support multiple possible environment variable names
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY; // Fallback to SUPABASE_KEY if SERVICE_ROLE_KEY not found

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const missing = [];
  if (!supabaseUrl) {
    missing.push('SUPABASE_URL');
  }
  if (!supabaseServiceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)');
  }
  throw new Error(
    `Missing Supabase environment variables: ${missing.join(', ')}\n\n` +
      `Please add these to your .env.local file:\n` +
      `SUPABASE_URL=your_supabase_project_url\n` +
      `SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key\n\n` +
      `Note: For admin operations, use SERVICE_ROLE_KEY (not anon key). ` +
      `Find it in Supabase Dashboard > Settings > API > service_role key (secret)`
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

