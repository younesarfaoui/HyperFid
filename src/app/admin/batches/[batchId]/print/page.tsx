import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { PrintButton } from "@/components/admin/print-button";
import { LinkButton } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { scanUrl } from "@/lib/csv";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Planche QR" };

const PER_PAGE = 120;

export default async function PrintBatchPage(props: PageProps<"/admin/batches/[batchId]/print">) {
  await requireSuperAdmin();
  const { batchId } = await props.params;
  const { page: pageParam } = await props.searchParams;
  if (!uuidSchema.safeParse(batchId).success) notFound();

  const page = Math.max(1, Number.parseInt(typeof pageParam === "string" ? pageParam : "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createClient();
  const { data: codes, count } = await supabase
    .from("qr_batches")
    .select("id, merchant_id, batch_label, is_scanned", { count: "exact" })
    .eq("batch_id", batchId)
    .order("created_at")
    .order("id")
    .range(from, from + PER_PAGE - 1);

  if (!codes?.length) notFound();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name")
    .eq("id", codes[0].merchant_id)
    .single();

  const base = appUrl();
  const svgs = await Promise.all(
    codes.map((c) =>
      QRCode.toString(scanUrl(base, c.id), { type: "svg", margin: 1, errorCorrectionLevel: "M", width: 160 }),
    ),
  );

  const total = count ?? codes.length;
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {merchant?.name} — {codes[0].batch_label || "Lot sans libellé"}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Codes {from + 1}–{from + codes.length} sur {total} · page {page}/{pages}
          </p>
        </div>
        <div className="flex gap-2">
          {page > 1 ? (
            <LinkButton href={`/admin/batches/${batchId}/print?page=${page - 1}`} size="sm">
              ← Précédente
            </LinkButton>
          ) : null}
          {page < pages ? (
            <LinkButton href={`/admin/batches/${batchId}/print?page=${page + 1}`} size="sm">
              Suivante →
            </LinkButton>
          ) : null}
          <PrintButton />
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
        {codes.map((c, i) => (
          <li
            key={c.id}
            className="break-inside-avoid rounded-lg border border-line bg-white p-3 text-center text-black print:border-neutral-300"
          >
            {/* SVG markup is produced server-side by `qrcode` from our own URL — no user input. */}
            <div className="mx-auto w-full max-w-[160px]" dangerouslySetInnerHTML={{ __html: svgs[i] }} />
            <p className="mt-1 text-xs font-semibold">{merchant?.name}</p>
            <p className="text-[10px] text-neutral-600">Scannez & tentez votre chance</p>
            <p className="mt-0.5 font-mono text-[9px] text-neutral-400">
              {c.id.slice(0, 8)}
              {c.is_scanned ? " · utilisé" : ""}
            </p>
          </li>
        ))}
      </ol>

      <p className="no-print mt-6 text-sm">
        <Link href={`/admin/merchants/${merchant?.id}`} className="text-ink-2 hover:text-ink">
          ← Retour au commerçant
        </Link>
      </p>
    </div>
  );
}
