import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Sessionless client for the public scan flow. Always runs as `anon`, even if
 * a merchant admin happens to be signed in on the same browser, so the scan
 * path only ever reaches the RPCs granted to anonymous visitors.
 */
export function createAnonClient() {
  return createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
