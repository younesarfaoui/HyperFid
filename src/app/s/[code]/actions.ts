"use server";

import { getOrCreateDeviceId, hashDevice } from "@/lib/device";
import type { ClaimResult } from "@/lib/rpc-types";
import { createAnonClient } from "@/lib/supabase/anon";
import { uuidSchema } from "@/lib/validation";
import { memberCode } from "@/lib/wallet/pass-content";
import { syncWalletPass } from "@/lib/wallet/sync";

export type ScanOutcome =
  | { status: "invalid" | "already_scanned" | "merchant_inactive" | "error" }
  | {
      status: "ok";
      isWinner: boolean;
      redemptionCode: string | null;
      scannedAt: string;
      merchantName: string;
      rewardDescription: string;
      brandColor: string;
      currentStamps: number;
      stampsGoal: number;
      isNewCustomer: boolean;
      memberCode: string;
      shareUrl: string | null;
      googleSaveUrl: string | null;
    };

/**
 * Claims a single-use QR code for this device. Runs on an explicit user
 * gesture (never on page load) so link previews and prefetchers cannot burn
 * codes. The exactly-once guarantee lives in the `claim_qr_scan` RPC.
 */
export async function claimScan(code: string): Promise<ScanOutcome> {
  const parsed = uuidSchema.safeParse(code);
  if (!parsed.success) return { status: "invalid" };

  const deviceId = await getOrCreateDeviceId();
  const supabase = createAnonClient();

  const { data, error } = await supabase.rpc("claim_qr_scan", {
    p_code: parsed.data,
    p_device_hash: hashDevice(deviceId),
  });

  if (error || !data) {
    console.error("[scan] claim_qr_scan failed:", error?.message);
    return { status: "error" };
  }

  const result = data as unknown as ClaimResult;
  if (result.status !== "ok") return { status: result.status };

  const pass = await syncWalletPass(
    {
      walletId: result.wallet.id,
      merchantName: result.merchant.name,
      rewardDescription: result.merchant.reward_description,
      brandColor: result.merchant.brand_color,
      currentStamps: result.wallet.current_stamps,
      stampsGoal: result.merchant.stamps_goal,
      rewardsRedeemed: result.wallet.rewards_redeemed,
    },
    {
      serialNumber: result.wallet.pass_serial,
      shareUrl: result.wallet.pass_share_url,
      googleSaveUrl: result.wallet.google_save_url,
    },
  );

  return {
    status: "ok",
    isWinner: result.is_winner,
    redemptionCode: result.redemption_code,
    scannedAt: result.scanned_at,
    merchantName: result.merchant.name,
    rewardDescription: result.merchant.reward_description,
    brandColor: result.merchant.brand_color,
    currentStamps: result.wallet.current_stamps,
    stampsGoal: result.merchant.stamps_goal,
    isNewCustomer: result.wallet.is_new,
    memberCode: memberCode(result.wallet.id),
    shareUrl: pass?.shareUrl ?? null,
    googleSaveUrl: pass?.googleSaveUrl ?? null,
  };
}
