import Link from "next/link";

import { DailyScansChart } from "@/components/charts/daily-scans-chart";
import { SingleBarChart } from "@/components/charts/single-bar-chart";
import { LiveScans } from "@/components/dashboard/live-scans";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { formatInt, formatPercent, plural } from "@/lib/format";
import type { MerchantAnalytics } from "@/lib/rpc-types";
import { createClient } from "@/lib/supabase/server";

const RANGES = [7, 30, 90] as const;

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { merchantId } = await requireMerchantAdmin();
  const { days: daysParam } = await props.searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;

  const supabase = await createClient();
  const [{ data: analyticsData, error }, { data: recent }] = await Promise.all([
    supabase.rpc("merchant_analytics", { p_merchant_id: merchantId, p_days: days }),
    supabase
      .from("qr_batches")
      .select("id, scan_date, is_winner, redemption_code, redeemed_at, wallet_id")
      .eq("merchant_id", merchantId)
      .eq("is_scanned", true)
      .order("scan_date", { ascending: false })
      .limit(8),
  ]);
  if (error || !analyticsData) throw new Error("Impossible de charger les statistiques.");

  const a = analyticsData as unknown as MerchantAnalytics;
  const k = a.kpis;
  const stock = k.codes_total - k.codes_scanned;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="La fidélité de vos clients, en temps réel."
        action={
          <nav aria-label="Période" className="inline-flex rounded-lg border border-line bg-card p-1">
            {RANGES.map((d) => (
              <Link
                key={d}
                href={`/dashboard?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium",
                  d === days ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink",
                )}
              >
                {d} j
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Clients fidélisés"
          value={formatInt(k.total_customers)}
          detail={`+${plural(k.new_customers, "nouveau", "nouveaux")} sur ${days} j`}
        />
        <StatTile
          label={`Scans (${days} j)`}
          value={formatInt(k.scans)}
          detail={plural(k.active_customers, "client actif", "clients actifs")}
        />
        <StatTile
          label="Taux de retour"
          value={formatPercent(k.returning_rate)}
          detail={`${k.avg_visits.toLocaleString("fr-TN")} visites / client en moyenne`}
        />
        <StatTile
          label={`Gains instantanés (${days} j)`}
          value={formatInt(k.wins)}
          detail={`${plural(k.wins_redeemed, "retiré", "retirés")} · ${plural(k.cards_completed, "carte complétée", "cartes complétées")}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visites par jour" description="Premières visites et clients qui reviennent" />
          <CardBody>
            <DailyScansChart data={a.daily} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Derniers scans" />
          <CardBody>
            <LiveScans merchantId={merchantId} initial={recent ?? []} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Fréquence de visite" description="Nombre de clients par nombre total de visites" />
          <CardBody>
            <SingleBarChart
              data={a.frequency.map((f) => ({ label: f.label, value: f.customers }))}
              valueLabel="Clients"
              height={220}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stock de QR codes" />
          <CardBody>
            <p className="text-3xl font-semibold tracking-tight text-ink">{formatInt(stock)}</p>
            <p className="mt-1 text-sm text-ink-2">
              {stock < 2 ? "code disponible" : "codes disponibles"} sur {formatInt(k.codes_total)} (
              {plural(k.codes_scanned, "scanné", "scannés")})
            </p>
            {stock < 100 ? (
              <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                <span aria-hidden>▲ </span>Stock bas : contactez HyperFid pour un nouveau lot.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
