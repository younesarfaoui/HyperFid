"use server";

import { redirect } from "next/navigation";

import { failure, type FormState } from "@/lib/form-state";
import { homePathFor } from "@/lib/auth/guards";
import { safeRelativePath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, loginSchema } from "@/lib/validation";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, ["email"]);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return failure("E-mail ou mot de passe incorrect.", formData, ["email"]);
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();

  if (!profile || (profile.role === "merchant_admin" && !profile.merchant_id)) {
    await supabase.auth.signOut();
    return failure("Ce compte n'est rattaché à aucun commerce. Contactez HyperFid.", formData, ["email"]);
  }

  const home = homePathFor(profile);
  const next = safeRelativePath(formData.get("next"));
  redirect(next && next.startsWith(home) ? next : home);
}
