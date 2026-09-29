"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { failure, success, type FormState } from "@/lib/form-state";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  batchCreateSchema,
  firstIssue,
  inviteSchema,
  merchantCreateSchema,
  uuidSchema,
} from "@/lib/validation";

const MERCHANT_KEYS = [
  "name",
  "category",
  "win_rate",
  "reward_description",
  "subscription_status",
  "stamps_goal",
  "brand_color",
] as const;

function merchantFields(formData: FormData) {
  return {
    name: formData.get("name"),
    category: formData.get("category"),
    win_rate: formData.get("win_rate"),
    reward_description: formData.get("reward_description"),
    subscription_status: formData.get("subscription_status"),
    stamps_goal: formData.get("stamps_goal"),
    brand_color: formData.get("brand_color"),
  };
}

export async function createMerchant(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = merchantCreateSchema.safeParse(merchantFields(formData));
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, MERCHANT_KEYS);

  const supabase = await createClient();
  const { data, error } = await supabase.from("merchants").insert(parsed.data).select("id").single();
  if (error || !data) return failure("Création impossible. Vérifiez les champs.", formData, MERCHANT_KEYS);

  revalidatePath("/admin", "layout");
  redirect(`/admin/merchants/${data.id}`);
}

export async function updateMerchant(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin();
  if (!uuidSchema.safeParse(merchantId).success) return failure("Commerçant inconnu.");

  const parsed = merchantCreateSchema.safeParse(merchantFields(formData));
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, MERCHANT_KEYS);

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").update(parsed.data).eq("id", merchantId);
  if (error) return failure("Mise à jour impossible.", formData, MERCHANT_KEYS);

  revalidatePath("/admin", "layout");
  return success("Commerçant mis à jour.");
}

export async function generateBatch(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = batchCreateSchema.safeParse({
    merchant_id: formData.get("merchant_id"),
    quantity: formData.get("quantity"),
    label: formData.get("label") ?? "",
  });
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, ["label", "quantity"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_qr_batch", {
    p_merchant_id: parsed.data.merchant_id,
    p_quantity: parsed.data.quantity,
    p_label: parsed.data.label,
  });
  if (error) return failure("Génération impossible.", formData, ["label", "quantity"]);

  revalidatePath(`/admin/merchants/${parsed.data.merchant_id}`);
  return success(`${parsed.data.quantity} QR codes générés.`);
}

export async function inviteMerchantAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = inviteSchema.safeParse({
    merchant_id: formData.get("merchant_id"),
    email: formData.get("email"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, ["email"]);
  const { merchant_id: merchantId, email } = parsed.data;

  const supabase = await createClient();

  // Existing account without a merchant (e.g. previously detached): re-attach it.
  const { data: existing } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existing) {
    if (existing.role !== "merchant_admin" || (existing.merchant_id && existing.merchant_id !== merchantId)) {
      return failure("Cet e-mail est déjà utilisé par un autre compte.", formData, ["email"]);
    }
    const { error } = await supabase.from("profiles").update({ merchant_id: merchantId }).eq("id", existing.id);
    if (error) return failure("Rattachement impossible.", formData, ["email"]);
    revalidatePath(`/admin/merchants/${merchantId}`);
    return success(`${email} a été rattaché à ce commerce.`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl()}/auth/set-password`,
  });
  if (error || !data.user) {
    return failure("Invitation impossible. Vérifiez l'adresse ou réessayez plus tard.", formData, ["email"]);
  }

  // The auth trigger created a detached merchant_admin profile; attach it (RLS: super admin).
  const { error: attachError } = await supabase
    .from("profiles")
    .update({ role: "merchant_admin", merchant_id: merchantId })
    .eq("id", data.user.id);
  if (attachError) return failure("Invitation envoyée mais rattachement impossible.");

  revalidatePath(`/admin/merchants/${merchantId}`);
  return success(`Invitation envoyée à ${email}.`);
}

export async function removeMerchantAdmin(merchantId: string, profileId: string): Promise<void> {
  const session = await requireSuperAdmin();
  if (!uuidSchema.safeParse(profileId).success || profileId === session.userId) return;

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", profileId).maybeSingle();
  if (!target || target.role !== "merchant_admin") return;

  const { error } = await createAdminClient().auth.admin.deleteUser(profileId);
  if (error) console.error("[admin] deleteUser failed:", error.message);

  revalidatePath(`/admin/merchants/${merchantId}`);
}
