import type { Metadata } from "next";

import { readableOn, safeHex } from "@/lib/color";
import type { QrPublicResult } from "@/lib/rpc-types";
import { createAnonClient } from "@/lib/supabase/anon";
import { uuidSchema } from "@/lib/validation";

import { ScanReveal } from "./scan-reveal";

export const metadata: Metadata = {
  title: "Tentez votre chance",
  // Keep link-preview bots from indexing single-use codes.
  robots: { index: false, follow: false, nocache: true },
};

async function lookup(code: string): Promise<QrPublicResult> {
  if (!uuidSchema.safeParse(code).success) return { status: "invalid" };
  const { data, error } = await createAnonClient().rpc("get_qr_public", { p_code: code });
  if (error || !data) return { status: "invalid" };
  return data as unknown as QrPublicResult;
}

export default async function ScanPage(props: PageProps<"/s/[code]">) {
  const { code } = await props.params;
  const result = await lookup(code);

  if (result.status === "invalid") {
    return (
      <ScanFrame brandColor="#5b3df5" merchantName="HyperFid">
        <Notice title="QR code invalide" body="Ce code n'est pas reconnu. Vérifiez que vous scannez un QR code HyperFid." />
      </ScanFrame>
    );
  }

  const brandColor = safeHex(result.merchant.brand_color);

  return (
    <ScanFrame brandColor={brandColor} merchantName={result.merchant.name} category={result.merchant.category}>
      <ScanReveal
        code={code}
        brandColor={brandColor}
        rewardDescription={result.merchant.reward_description}
        initialStatus={result.status}
      />
    </ScanFrame>
  );
}

function ScanFrame({
  brandColor,
  merchantName,
  category,
  children,
}: {
  brandColor: string;
  merchantName: string;
  category?: string;
  children: React.ReactNode;
}) {
  const ink = readableOn(brandColor);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 pb-16 pt-8 text-center" style={{ backgroundColor: brandColor, color: ink }}>
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">{category ?? "Fidélité"}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{merchantName}</p>
      </header>
      <main className="-mt-10 flex-1 px-4 pb-10">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-surface p-5 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">Propulsé par HyperFid</p>
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
    </div>
  );
}
