import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { getWalletProvider } from "./index";
import type { LoyaltyPassInput } from "./types";

export type SyncedPass = {
  serialNumber: string;
  shareUrl: string | null;
  googleSaveUrl: string | null;
};

type ExistingPass = {
  serialNumber: string | null;
  shareUrl: string | null;
  googleSaveUrl: string | null;
};

/**
 * Pushes the wallet's current state to the Wallet provider. The database stays
 * the source of truth: failures are logged and swallowed so a scan never fails
 * because of the pass provider — the next scan re-syncs.
 */
export async function syncWalletPass(
  input: LoyaltyPassInput,
  existing: ExistingPass,
): Promise<SyncedPass | null> {
  const provider = getWalletProvider();
  const admin = createAdminClient();

  try {
    if (existing.serialNumber) {
      await provider.updatePass(existing.serialNumber, input);
      await admin
        .from("digital_wallets")
        .update({ pass_synced_at: new Date().toISOString() })
        .eq("id", input.walletId);
      return {
        serialNumber: existing.serialNumber,
        shareUrl: existing.shareUrl,
        googleSaveUrl: existing.googleSaveUrl,
      };
    }

    const pass = await provider.createPass(input);

    // Only claim the serial if no concurrent scan stored one first.
    const { data: stored } = await admin
      .from("digital_wallets")
      .update({
        pass_serial: pass.serialNumber,
        pass_share_url: pass.shareUrl,
        google_save_url: pass.googleSaveUrl,
        pass_synced_at: new Date().toISOString(),
      })
      .eq("id", input.walletId)
      .is("pass_serial", null)
      .select("id")
      .maybeSingle();

    if (stored) return pass;

    const { data: winner } = await admin
      .from("digital_wallets")
      .select("pass_serial, pass_share_url, google_save_url")
      .eq("id", input.walletId)
      .single();

    if (!winner?.pass_serial) return pass;
    await provider.updatePass(winner.pass_serial, input);
    return {
      serialNumber: winner.pass_serial,
      shareUrl: winner.pass_share_url,
      googleSaveUrl: winner.google_save_url,
    };
  } catch (error) {
    console.error(`[wallet] ${provider.name} sync failed for wallet ${input.walletId}:`, error);
    return existing.serialNumber
      ? {
          serialNumber: existing.serialNumber,
          shareUrl: existing.shareUrl,
          googleSaveUrl: existing.googleSaveUrl,
        }
      : null;
  }
}
