"use server";

import { revalidatePath } from "next/cache";

import { requireMerchantAdmin } from "@/lib/auth/guards";
import { myCardUrl } from "@/lib/env";
import { failure, success, type FormState } from "@/lib/form-state";
import { formatDateTime } from "@/lib/format";
import type { RedeemStampCardResult, RedeemWinResult } from "@/lib/rpc-types";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, merchantSettingsSchema, redemptionCodeSchema, uuidSchema } from "@/lib/validation";
import { syncWalletPass } from "@/lib/wallet/sync";

const SETTINGS_KEYS = ["reward_description", "stamps_goal", "brand_color"] as const;

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { merchantId } = await requireMerchantAdmin();

  const parsed = merchantSettingsSchema.safeParse({
    reward_description: formData.get("reward_description"),
    stamps_goal: formData.get("stamps_goal"),
    brand_color: formData.get("brand_color"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, SETTINGS_KEYS);

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").update(parsed.data).eq("id", merchantId);
  if (error) return failure("Mise à jour impossible.", formData, SETTINGS_KEYS);

  revalidatePath("/dashboard", "layout");
  return success("Paramètres enregistrés.");
}

async function redeem(merchantId: string, code: string): Promise<RedeemWinResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_win", { p_merchant_id: merchantId, p_code: code });
  if (error || !data) {
    console.error("[dashboard] redeem_win failed:", error?.message);
    return null;
  }
  return data as unknown as RedeemWinResult;
}

export async function redeemWinByCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { merchantId } = await requireMerchantAdmin();

  const parsed = redemptionCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return failure(firstIssue(parsed.error), formData, ["code"]);

  const result = await redeem(merchantId, parsed.data);
  if (!result) return failure("Vérification impossible, réessayez.", formData, ["code"]);

  revalidatePath("/dashboard", "layout");
  switch (result.status) {
    case "redeemed":
      return success(
        `✓ Code ${result.redemption_code} validé (gagné le ${formatDateTime(result.scan_date)}). Remettez la récompense.`,
      );
    case "already_redeemed":
      return failure(`Code déjà utilisé le ${formatDateTime(result.redeemed_at)}. Ne remettez pas la récompense.`);
    default:
      return failure("Code introuvable pour votre commerce.", formData, ["code"]);
  }
}

export async function markWinRedeemed(code: string): Promise<void> {
  const { merchantId } = await requireMerchantAdmin();
  const parsed = redemptionCodeSchema.safeParse(code);
  if (!parsed.success) return;
  await redeem(merchantId, parsed.data);
  revalidatePath("/dashboard", "layout");
}

export async function redeemStampCard(walletId: string): Promise<void> {
  const { merchantId } = await requireMerchantAdmin();
  if (!uuidSchema.safeParse(walletId).success) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_stamp_card", { p_wallet_id: walletId });
  if (error || !data) {
    console.error("[dashboard] redeem_stamp_card failed:", error?.message);
    return;
  }

  const result = data as unknown as RedeemStampCardResult;
  if (result.status === "redeemed") {
    const [{ data: wallet }, { data: merchant }] = await Promise.all([
      supabase.from("digital_wallets").select("*").eq("id", walletId).single(),
      supabase.from("merchants").select("*").eq("id", merchantId).single(),
    ]);

    if (wallet && merchant) {
      await syncWalletPass(
        {
          walletId: wallet.id,
          merchantName: merchant.name,
          rewardDescription: merchant.reward_description,
          brandColor: merchant.brand_color,
          currentStamps: wallet.current_stamps,
          stampsGoal: merchant.stamps_goal,
          rewardsRedeemed: wallet.rewards_redeemed,
          cardUrl: myCardUrl(),
        },
        {
          serialNumber: wallet.pass_serial,
          shareUrl: wallet.pass_share_url,
          googleSaveUrl: wallet.google_save_url,
        },
      );
    }
  }

  revalidatePath("/dashboard", "layout");
}
