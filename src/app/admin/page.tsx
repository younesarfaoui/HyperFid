import Link from "next/link";

import { SingleBarChart } from "@/components/charts/single-bar-chart";
import { QuickBatchButton } from "@/components/admin/quick-batch-button";
import { PageHeader } from "@/components/shell/app-shell";
import { SubscriptionBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { formatInt, plural, STATUS_LABELS } from "@/lib/format";
import type { PlatformOverview } from "@/lib/rpc-types";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error || !data) throw new Error("Impossible de charger la vue d'ensemble.");
  const overview = data as unknown as PlatformOverview;

  const top = overview.merchants.slice(0, 10).map((m) => ({ label: m.name, value: m.scans_30d }));

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        description="Activité de la plateforme sur les 30 derniers jours."
        action={
          <LinkButton href="/admin/merchants/new" variant="primary">
            Nouveau commerçant
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Commerçants actifs"
          value={formatInt(overview.totals.active_merchants)}
          detail={`${formatInt(overview.totals.merchants)} au total`}
        />
        <StatTile label="Clients fidélisés" value={formatInt(overview.totals.customers)} />
        <StatTile
          label="Scans (30 j)"
          value={formatInt(overview.totals.scans_30d)}
          detail={plural(overview.totals.wins_30d, "gain instantané", "gains instantanés")}
        />
        <StatTile label="QR codes en stock" value={formatInt(overview.totals.codes_available)} detail="non scannés" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Scans par commerçant" description="Top 10, 30 derniers jours" />
          <CardBody>
            {top.length ? (
              <SingleBarChart data={top} valueLabel="Scans (30 j)" horizontal height={Math.max(160, top.length * 36)} />
            ) : (
              <p className="py-8 text-center text-sm text-ink-2">Aucun commerçant pour le moment.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Abonnements" />
          <CardBody>
            <ul className="space-y-2">
              {Object.keys(STATUS_LABELS).map((status) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <SubscriptionBadge status={status} />
                  <span className="font-medium tabular-nums text-ink">
                    {formatInt(overview.by_status[status] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Commerçants" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-2 text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Commerçant</th>
                <th scope="col" className="px-5 py-2 font-medium">Statut</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Clients</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Scans 30 j</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Stock QR</th>
                <th scope="col" className="px-5 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {overview.merchants.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/admin/merchants/${m.id}`} className="font-medium text-ink hover:text-brand">
                      {m.name}
                    </Link>
                    <p className="text-xs text-muted">{m.category}</p>
                  </td>
                  <td className="px-5 py-3">
                    <SubscriptionBadge status={m.subscription_status} />
                  </td>
                  <td className="px-5 py-3 text-right">{formatInt(m.customers)}</td>
                  <td className="px-5 py-3 text-right">{formatInt(m.scans_30d)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={m.codes_available < 50 ? "font-medium text-critical" : undefined}>
                      {formatInt(m.codes_available)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <QuickBatchButton merchantId={m.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
