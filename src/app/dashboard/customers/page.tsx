import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { formatDate, formatInt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { memberCode } from "@/lib/wallet/pass-content";

import { redeemStampCard } from "../actions";

export const metadata: Metadata = { title: "Clients" };

const PER_PAGE = 50;

export default async function CustomersPage(props: PageProps<"/dashboard/customers">) {
  const { merchantId } = await requireMerchantAdmin();
  const { page: pageParam, complete } = await props.searchParams;
  const page = Math.max(1, Number.parseInt(typeof pageParam === "string" ? pageParam : "1", 10) || 1);
  const onlyComplete = complete === "1";

  const supabase = await createClient();
  const { data: merchant } = await supabase.from("merchants").select("stamps_goal").eq("id", merchantId).single();
  const goal = merchant?.stamps_goal ?? 10;

  let query = supabase
    .from("digital_wallets")
    .select(
      "id, current_stamps, rewards_redeemed, last_scan_date, created_at, pass_serial, qr_batches(count)",
      { count: "exact" },
    )
    .eq("merchant_id", merchantId)
    .order("last_scan_date", { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (onlyComplete) query = query.gte("current_stamps", goal);

  const { data: wallets, count, error } = await query;
  if (error) throw new Error("Impossible de charger les clients.");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => `/dashboard/customers?page=${p}${onlyComplete ? "&complete=1" : ""}`;

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${formatInt(total)} carte${total > 1 ? "s" : ""} de fidélité${onlyComplete ? " complète(s)" : ""}`}
        action={
          <nav aria-label="Filtre" className="inline-flex rounded-lg border border-line bg-card p-1">
            {[
              { href: "/dashboard/customers", label: "Tous", active: !onlyComplete },
              { href: "/dashboard/customers?complete=1", label: "Cartes complètes", active: onlyComplete },
            ].map((f) => (
              <Link
                key={f.href}
                href={f.href}
                aria-current={f.active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium",
                  f.active ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-2 text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Membre</th>
                <th scope="col" className="px-5 py-2 font-medium">Tampons</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Visites</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Cartes complétées</th>
                <th scope="col" className="px-5 py-2 font-medium">Dernière visite</th>
                <th scope="col" className="px-5 py-2 font-medium">Wallet</th>
                <th scope="col" className="px-5 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(wallets ?? []).map((w) => {
                const visits = w.qr_batches?.[0]?.count ?? 0;
                const pct = Math.min(100, Math.round((100 * w.current_stamps) / goal));
                const ready = w.current_stamps >= goal;
                return (
                  <tr key={w.id} className="border-t border-line">
                    <td className="px-5 py-3 font-medium text-ink">{memberCode(w.id)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-2" aria-hidden>
                          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-ink-2">
                          {w.current_stamps} / {goal}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">{formatInt(visits)}</td>
                    <td className="px-5 py-3 text-right">{formatInt(w.rewards_redeemed)}</td>
                    <td className="px-5 py-3 text-ink-2">{formatDate(w.last_scan_date)}</td>
                    <td className="px-5 py-3">
                      {w.pass_serial ? <Badge tone="good">Ajouté</Badge> : <Badge>En attente</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {ready ? (
                        <form action={redeemStampCard.bind(null, w.id)}>
                          <Button type="submit" size="sm">
                            Valider la carte
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!wallets?.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-2">
                    {onlyComplete ? "Aucune carte complète pour le moment." : "Aucun client pour le moment."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-2">
          <span>
            Page {page} / {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <LinkButton href={qs(page - 1)} size="sm">
                ← Précédente
              </LinkButton>
            ) : null}
            {page < pages ? (
              <LinkButton href={qs(page + 1)} size="sm">
                Suivante →
              </LinkButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
