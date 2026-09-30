import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { scanUrl, toCsv } from "@/lib/csv";
import { appUrl } from "@/lib/env";
import type { Database } from "@/types/database";

export type BatchCode = {
  id: string;
  batch_label: string;
  created_at: string;
  is_scanned: boolean;
};

const PAGE = 1000;

/** All codes of a print run, in print order. Paged: PostgREST caps responses (max_rows). */
export async function fetchBatchCodes(supabase: SupabaseClient<Database>, batchId: string): Promise<BatchCode[]> {
  const rows: BatchCode[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("qr_batches")
      .select("id, batch_label, created_at, is_scanned")
      .eq("batch_id", batchId)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load batch ${batchId}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  return rows;
}

/** CSV for variable-data printing: one public scan URL per physical QR code. */
export function batchCsv(rows: BatchCode[]): string {
  const base = appUrl();
  return toCsv(
    ["n", "code", "url", "batch_label", "created_at", "scanned"],
    rows.map((r, i) => [i + 1, r.id, scanUrl(base, r.id), r.batch_label, r.created_at, r.is_scanned]),
  );
}

export function csvDownload(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
