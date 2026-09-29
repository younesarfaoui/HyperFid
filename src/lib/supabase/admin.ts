import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client: bypasses RLS. Restricted to two jobs:
 *   1. Auth admin API (inviting / removing merchant admins) — callers must
 *      have passed `requireSuperAdmin()` first.
 *   2. Writing wallet-pass sync metadata after a successful claim.
 * Never import this from a Client Component or expose its results unfiltered.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
