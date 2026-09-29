import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type SessionProfile = {
  userId: string;
  email: string | null;
  profile: Profile;
};

/**
 * Authoritative identity lookup: `getUser()` validates the session with the
 * Auth server (never trust the cookie alone), then the profile is read through
 * RLS. Memoised per request.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
});

export function homePathFor(profile: Profile): string {
  return profile.role === "super_admin" ? "/admin" : "/dashboard";
}

/** Use in /admin layouts, pages, route handlers and every admin Server Action. */
export async function requireSuperAdmin(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.role !== "super_admin") redirect(homePathFor(session.profile));
  return session;
}

export type MerchantSession = SessionProfile & { merchantId: string };

/** Use in /dashboard layouts, pages and every merchant Server Action. */
export async function requireMerchantAdmin(): Promise<MerchantSession> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.role === "super_admin") redirect("/admin");
  if (!session.profile.merchant_id) redirect("/login?error=no_merchant");
  return { ...session, merchantId: session.profile.merchant_id };
}
