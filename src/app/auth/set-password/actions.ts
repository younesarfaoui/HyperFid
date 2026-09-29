"use server";

import { redirect } from "next/navigation";

import { failure, type FormState } from "@/lib/form-state";
import { getSessionProfile, homePathFor } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, passwordSchema } from "@/lib/validation";

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) redirect("/login?error=link_invalid");

  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure("Impossible d'enregistrer le mot de passe. Réessayez.");

  redirect(homePathFor(session.profile));
}
