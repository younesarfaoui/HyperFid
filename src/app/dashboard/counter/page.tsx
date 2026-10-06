import type { Metadata } from "next";

import { CounterScreen } from "@/components/dashboard/counter-screen";
import { PageHeader } from "@/components/shell/app-shell";
import { requireMerchantAdmin } from "@/lib/auth/guards";
import { safeHex } from "@/lib/color";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mode caisse" };

export default async function CounterPage() {
  const { merchantId } = await requireMerchantAdmin();

  const supabase = await createClient();
  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("name, reward_description, brand_color")
    .eq("id", merchantId)
    .single();
  if (error || !merchant) throw new Error("Impossible de charger le commerce.");

  return (
    <>
      <PageHeader
        title="Mode caisse"
        description="Posez ce téléphone ou cette tablette face au client : un QR code unique par client, renouvelé automatiquement. Rien à imprimer."
      />
      <CounterScreen
        merchantId={merchantId}
        merchantName={merchant.name}
        rewardDescription={merchant.reward_description}
        brandColor={safeHex(merchant.brand_color)}
      />
    </>
  );
}
