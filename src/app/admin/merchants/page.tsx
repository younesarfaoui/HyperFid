import type { Metadata } from "next";
import Link from "next/link";

import { QuickBatchButton } from "@/components/admin/quick-batch-button";
import { PageHeader } from "@/components/shell/app-shell";
import { SubscriptionBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { formatDate, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Commerçants" };

export default async function MerchantsPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les commerçants.");

  return (
    <>
      <PageHeader
        title="Commerçants"
        description={`${merchants.length} commerce${merchants.length > 1 ? "s" : ""} sur la plateforme`}
        action={
          <LinkButton href="/admin/merchants/new" variant="primary">
            Nouveau commerçant
          </LinkButton>
        }
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-2 text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Commerçant</th>
                <th scope="col" className="px-5 py-2 font-medium">Récompense</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Taux de gain</th>
                <th scope="col" className="px-5 py-2 font-medium">Statut</th>
                <th scope="col" className="px-5 py-2 font-medium">Créé le</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">QR codes</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: m.brand_color }} />
                      <Link href={`/admin/merchants/${m.id}`} className="font-medium text-ink hover:text-brand">
                        {m.name}
                      </Link>
                    </div>
                    <p className="text-xs text-muted">{m.category}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{m.reward_description}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatPercent(Number(m.win_rate), 2)}</td>
                  <td className="px-5 py-3">
                    <SubscriptionBadge status={m.subscription_status} />
                  </td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(m.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <QuickBatchButton merchantId={m.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {merchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-2">
                    Aucun commerçant. Créez le premier pour générer ses QR codes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
