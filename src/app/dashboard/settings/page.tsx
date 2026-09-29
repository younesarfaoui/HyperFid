import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/app-shell";
import { SubscriptionBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const { merchantId } = await requireMerchantAdmin();
  const supabase = await createClient();
  const { data: merchant, error } = await supabase.from("merchants").select("*").eq("id", merchantId).single();
  if (error || !merchant) throw new Error("Commerce introuvable.");

  return (
    <>
      <PageHeader title="Paramètres" description="Personnalisez votre programme de fidélité." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Programme" />
          <CardBody>
            <SettingsForm merchant={merchant} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Géré par HyperFid" description="Contactez-nous pour modifier ces réglages." />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Commerce</dt>
                <dd className="font-medium text-ink">{merchant.name}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Catégorie</dt>
                <dd className="font-medium text-ink">{merchant.category}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Taux de gain</dt>
                <dd className="font-medium tabular-nums text-ink">{formatPercent(Number(merchant.win_rate), 2)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Abonnement</dt>
                <dd>
                  <SubscriptionBadge status={merchant.subscription_status} />
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
