"use server";

import { requireMerchantAdmin } from "@/lib/auth/guards";
import type { CounterCode } from "@/lib/counter";
import { scanUrl } from "@/lib/csv";
import { appUrl } from "@/lib/env";
import type { IssueCounterCodeResult } from "@/lib/rpc-types";
import { createClient } from "@/lib/supabase/server";

/** Next single-use code for the merchant's counter screen ("Mode caisse"). */
export async function issueCounterCode(): Promise<CounterCode> {
  const { merchantId } = await requireMerchantAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_counter_code", { p_merchant_id: merchantId });
  if (error || !data) {
    console.error("[counter] issue_counter_code failed:", error?.message);
    return { status: "error" };
  }

  const result = data as unknown as IssueCounterCodeResult;
  if (result.status !== "ok") return { status: result.status };

  return { status: "ok", id: result.id, url: scanUrl(appUrl(), result.id), expiresAt: result.expires_at };
}
