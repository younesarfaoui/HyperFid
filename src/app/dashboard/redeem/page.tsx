import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { memberCode } from "@/lib/wallet/pass-content";

import { markWinRedeemed } from "../actions";
import { RedeemForm } from "./redeem-form";

export const metadata: Metadata = { title: "Valider un gain" };

export default async function RedeemPage() {
  const { merchantId } = await requireMerchantAdmin();
  const supabase = await createClient();

  const [{ data: merchant }, { data: pending }] = await Promise.all([
    supabase.from("merchants").select("reward_description").eq("id", merchantId).single(),
    supabase
      .from("qr_batches")
      .select("id, redemption_code, scan_date, wallet_id")
      .eq("merchant_id", merchantId)
      .eq("is_winner", true)
      .is("redeemed_at", null)
      .order("scan_date", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="Valider un gain"
        description={`Récompense en cours : ${merchant?.reward_description ?? "—"}`}
      />

      <Card>
        <CardBody className="py-6">
          <RedeemForm />
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Gains en attente de retrait" description={`${pending?.length ?? 0} gain(s) non retiré(s)`} />
        <ul className="divide-y divide-line">
          {(pending ?? []).map((win) => (
            <li key={win.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-mono text-lg font-semibold tracking-widest text-ink">{win.redemption_code}</p>
                <p className="text-xs text-muted">
                  {win.wallet_id ? memberCode(win.wallet_id) : "Client"} · gagné le {formatDateTime(win.scan_date)}
                </p>
              </div>
              <form action={markWinRedeemed.bind(null, win.redemption_code ?? "")}>
                <Button type="submit" variant="secondary" size="sm">
                  Marquer comme retiré
                </Button>
              </form>
            </li>
          ))}
          {!pending?.length ? (
            <li className="px-5 py-8 text-center text-sm text-ink-2">Aucun gain en attente.</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}
