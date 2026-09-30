import { NextResponse, type NextRequest } from "next/server";

import { getSessionProfile } from "@/lib/auth/guards";
import { batchCsv, csvDownload, fetchBatchCodes } from "@/lib/qr-export";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

/** CSV of an existing print run (one scan URL per QR code) for re-printing. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/batches/[batchId]/export">) {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { batchId } = await ctx.params;
  if (!uuidSchema.safeParse(batchId).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let rows;
  try {
    rows = await fetchBatchCodes(await createClient(), batchId);
  } catch (error) {
    console.error("[admin] batch export failed:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return csvDownload(batchCsv(rows), `hyperfid-lot-${batchId.slice(0, 8)}.csv`);
}
