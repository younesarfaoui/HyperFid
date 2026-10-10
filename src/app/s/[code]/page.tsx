import type { Metadata } from "next";

import { ScanFrame } from "@/components/scan/scan-frame";
import { safeHex } from "@/lib/color";
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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{body}</p>
    </div>
  );
}
