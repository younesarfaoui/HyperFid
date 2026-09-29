import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BatchForm } from "@/components/admin/batch-form";
import { InviteForm } from "@/components/admin/invite-form";
import { MerchantForm } from "@/components/admin/merchant-form";
import { PageHeader } from "@/components/shell/app-shell";
import { SubscriptionBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { formatDate, formatInt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

import { removeMerchantAdmin, updateMerchant } from "../../actions";

export const metadata: Metadata = { title: "Commerçant" };

export default async function MerchantDetailPage(props: PageProps<"/admin/merchants/[id]">) {
  await requireSuperAdmin();
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: merchant }, { data: team }, { data: batches }] = await Promise.all([
    supabase.from("merchants").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("*").eq("merchant_id", id).order("created_at"),
    supabase.from("qr_batch_summaries").select("*").eq("merchant_id", id).order("created_at", { ascending: false }),
  ]);

  if (!merchant) notFound();

  return (
    <>
      <PageHeader
        title={merchant.name}
        description={
          <span className="inline-flex items-center gap-2">
            {merchant.category} · <SubscriptionBadge status={merchant.subscription_status} />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Paramètres du programme" />
          <CardBody>
            <MerchantForm action={updateMerchant.bind(null, merchant.id)} merchant={merchant} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Gérants" description="Accès au tableau de bord du commerce." />
          <CardBody className="space-y-5">
            <ul className="divide-y divide-line">
              {(team ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{member.email}</p>
                    <p className="text-xs text-muted">Depuis le {formatDate(member.created_at)}</p>
                  </div>
                  <form action={removeMerchantAdmin.bind(null, merchant.id, member.id)}>
                    <Button type="submit" variant="danger" size="sm">
                      Retirer
                    </Button>
                  </form>
                </li>
              ))}
              {!team?.length ? <li className="py-2 text-sm text-ink-2">Aucun gérant invité.</li> : null}
            </ul>
            <InviteForm merchantId={merchant.id} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Lots de QR codes"
          description="Chaque code est à usage unique. Exportez en CSV pour l'imprimeur ou imprimez la planche."
        />
        <CardBody>
          <BatchForm merchantId={merchant.id} />
        </CardBody>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-2 text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Lot</th>
                <th scope="col" className="px-5 py-2 font-medium">Créé le</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Codes</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Scannés</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Gagnants</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(batches ?? []).map((b) => (
                <tr key={b.batch_id} className="border-t border-line">
                  <td className="px-5 py-3 font-medium text-ink">{b.batch_label || "Sans libellé"}</td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(b.created_at)}</td>
                  <td className="px-5 py-3 text-right">{formatInt(b.total)}</td>
                  <td className="px-5 py-3 text-right">
                    {formatInt(b.scanned)}
                    <span className="ml-1 text-xs text-muted">
                      ({b.total ? Math.round((100 * b.scanned) / b.total) : 0} %)
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{formatInt(b.wins)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/admin/batches/${b.batch_id}/export`} size="sm" prefetch={false}>
                        CSV
                      </LinkButton>
                      <LinkButton href={`/admin/batches/${b.batch_id}/print`} size="sm">
                        Imprimer
                      </LinkButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!batches?.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-2">
                    Aucun lot généré.
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
