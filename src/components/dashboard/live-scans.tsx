"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { memberCode } from "@/lib/wallet/pass-content";
import type { QrCode } from "@/types/database";

export type LiveScan = Pick<QrCode, "id" | "scan_date" | "is_winner" | "redemption_code" | "redeemed_at" | "wallet_id">;

const MAX_ITEMS = 8;
const REFRESH_DEBOUNCE_MS = 4000;
const FRESH_SCAN_MS = 5 * 60 * 1000;

/** Live scan feed over Supabase Realtime (RLS-filtered per subscriber). */
export function LiveScans({ merchantId, initial }: { merchantId: string; initial: LiveScan[] }) {
  const router = useRouter();
  const [items, setItems] = useState<LiveScan[]>(initial);
  const [connected, setConnected] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`scans:${merchantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qr_batches", filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const row = payload.new as QrCode;
          if (!row.is_scanned || !row.scan_date) return;

          setItems((prev) => {
            const exists = prev.some((i) => i.id === row.id);
            if (exists) return prev.map((i) => (i.id === row.id ? row : i));
            if (Date.now() - new Date(row.scan_date!).getTime() > FRESH_SCAN_MS) return prev;
            return [row, ...prev].slice(0, MAX_ITEMS);
          });

          if (refreshTimer.current === null) {
            refreshTimer.current = window.setTimeout(() => {
              refreshTimer.current = null;
              router.refresh();
            }, REFRESH_DEBOUNCE_MS);
          }
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [merchantId, router]);

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-xs text-ink-2">
        <span
          aria-hidden
          className={connected ? "size-2 animate-pulse rounded-full bg-good" : "size-2 rounded-full bg-muted"}
        />
        {connected ? "En direct" : "Connexion au flux…"}
      </p>
      {items.length ? (
        <ul className="divide-y divide-line" aria-live="polite">
          {items.map((scan) => (
            <li key={scan.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">{scan.wallet_id ? memberCode(scan.wallet_id) : "Client"}</p>
                <p className="text-xs text-muted">{formatDateTime(scan.scan_date)}</p>
              </div>
              {scan.is_winner ? (
                <Badge tone={scan.redeemed_at ? "neutral" : "brand"}>
                  {scan.redeemed_at ? "Gain retiré" : `Gagnant · ${scan.redemption_code}`}
                </Badge>
              ) : (
                <Badge>+1 tampon</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-ink-2">Aucun scan pour le moment.</p>
      )}
    </div>
  );
}
