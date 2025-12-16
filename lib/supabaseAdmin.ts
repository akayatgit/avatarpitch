// Use dynamic require to avoid ESM import issues in Vercel serverless
let supabaseAdminInstance: any = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

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

  // Use require instead of import to avoid ESM issues in serverless
  const { createClient } = require('@supabase/supabase-js');
  
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

// Create a proxy to lazily initialize the client
export const supabaseAdmin = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = client[prop];
    
    // If it's a function, bind it to the client to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    
    return value;
  },
});

