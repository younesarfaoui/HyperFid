import "server-only";

import { httpUrlOrNull } from "@/lib/http";
import type { ClaimResult } from "@/lib/rpc-types";
import { createAnonClient } from "@/lib/supabase/anon";
import { uuidSchema } from "@/lib/validation";
import { memberCode } from "@/lib/wallet/pass-content";
import { syncWalletPass } from "@/lib/wallet/sync";

import type { ScanOutcome } from "./types";

/**
 * The scan transaction. All of the money-relevant work happens atomically in
 * the `claim_qr_scan` Postgres function (SECURITY DEFINER, anon-callable):
 *   1. lock the QR row and verify it exists and is not scanned,
 *   2. refuse inactive merchants without burning the code,
 *   3. roll a CSPRNG number against the merchant's win_rate,
 *   4. upsert the device's wallet and add a stamp,
 *   5. flip the code to is_scanned = true (with winner + redemption code).
 * The Wallet pass is then created/updated through the provider; a provider
 * failure never undoes the scan (the next scan re-syncs).
 */
export async function claimScan(code: string, deviceHash: string): Promise<ScanOutcome> {
  if (!uuidSchema.safeParse(code).success) return { status: "invalid" };

  const { data, error } = await createAnonClient().rpc("claim_qr_scan", {
    p_code: code,
    p_device_hash: deviceHash,
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

  // Third-party URLs: only http(s) may reach the page's links and redirect.
  const shareUrl = httpUrlOrNull(pass?.shareUrl);
  const googleSaveUrl = httpUrlOrNull(pass?.googleSaveUrl);

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
    passUrl: shareUrl ?? googleSaveUrl,
    shareUrl,
    googleSaveUrl,
  };
}
