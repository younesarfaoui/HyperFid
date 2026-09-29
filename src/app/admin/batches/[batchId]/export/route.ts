import { NextResponse, type NextRequest } from "next/server";

import { getSessionProfile } from "@/lib/auth/guards";
import { scanUrl, toCsv } from "@/lib/csv";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

const PAGE = 1000;

/** CSV of a print run for variable-data printing (one URL per QR code). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/batches/[batchId]/export">) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { batchId } = await ctx.params;
  if (!uuidSchema.safeParse(batchId).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const rows: { id: string; batch_label: string; created_at: string; is_scanned: boolean }[] = [];

  // PostgREST caps responses (max_rows); page through the batch.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("qr_batches")
      .select("id, batch_label, created_at, is_scanned")
      .eq("batch_id", batchId)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const base = appUrl();
  const csv = toCsv(
    ["n", "code", "url", "batch_label", "created_at", "scanned"],
    rows.map((r, i) => [i + 1, r.id, scanUrl(base, r.id), r.batch_label, r.created_at, r.is_scanned]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hyperfid-lot-${batchId.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
