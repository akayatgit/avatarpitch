/**
 * COMPATIBILITY SHIM — Supabase has been fully removed (Ashok's ruling:
 * "No Supabase, anywhere"). App state now lives in a local SQLite file
 * (see lib/localDb.ts) and files live on local disk (see lib/storage.ts).
 *
 * The `supabaseAdmin` export name is kept so the existing call sites keep
 * working unchanged; it is backed entirely by SQLite. New code should
 * import { localDb } from '@/lib/localDb' directly.
 */

import { localDb } from '@/lib/localDb';

export const supabaseAdmin = localDb;
