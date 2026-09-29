import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { STATUS_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Tableau de bord", template: "%s · HyperFid" } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const session = await requireMerchantAdmin();
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, subscription_status")
    .eq("id", session.merchantId)
    .maybeSingle();

  const inactive = merchant && !["trial", "active"].includes(merchant.subscription_status);

  return (
    <AppShell
      area="Espace commerçant"
      subtitle={merchant?.name}
      email={session.email}
      nav={[
        { href: "/dashboard", label: "Tableau de bord", exact: true },
        { href: "/dashboard/redeem", label: "Valider un gain" },
        { href: "/dashboard/customers", label: "Clients" },
        { href: "/dashboard/settings", label: "Paramètres" },
      ]}
    >
      {inactive ? (
        <div role="alert" className="mb-6 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <span aria-hidden>▲ </span>
          Abonnement « {STATUS_LABELS[merchant.subscription_status]} » : les scans de vos clients sont suspendus.
          Contactez HyperFid pour réactiver votre programme.
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
