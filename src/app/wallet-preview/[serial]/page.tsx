import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Aperçu Wallet (mock)" };

/** Local-development stand-in for the provider's hosted "Add to Wallet" page. */
export default async function WalletPreviewPage(props: PageProps<"/wallet-preview/[serial]">) {
  if ((process.env.WALLET_PROVIDER ?? "mock") !== "mock") notFound();

  const { serial } = await props.params;
  const { platform } = await props.searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Mode mock</p>
        <h1 className="mt-1 text-lg font-semibold text-ink">
          {platform === "google" ? "Google Wallet" : "Apple Wallet"}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          En production, ce lien ouvre la page d&apos;ajout au Wallet de WalletWallet.dev.
        </p>
        <p className="mt-4 break-all rounded-lg bg-card-2 px-3 py-2 font-mono text-xs text-ink-2">{serial}</p>
      </Card>
    </div>
  );
}
