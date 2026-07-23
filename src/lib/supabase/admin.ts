import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env, getServiceRoleKey } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server code
 * (route handlers / server actions), e.g. the public order-placement endpoint.
 * NEVER import this into a client component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
