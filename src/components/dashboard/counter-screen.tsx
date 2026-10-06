"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

import { issueCounterCode } from "@/app/dashboard/counter/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { readableOn } from "@/lib/color";
import { COUNTER_ROTATE_SECONDS, COUNTER_SCANNED_PAUSE_MS, type CounterCode } from "@/lib/counter";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const RETRY_MS = 5000;
const TOO_MANY_RETRY_MS = 60_000;
// Realtime is the fast path; polling covers networks that block websockets.
const POLL_MS = 3000;
const POLL_WHEN_LIVE_MS = 10_000;

type Blocked = Exclude<CounterCode["status"], "ok">;

type View =
  | { kind: "loading" }
  | { kind: "code"; id: string; svg: string; rotatesAt: number }
  | { kind: "scanned" }
  | { kind: "blocked"; reason: Blocked };

const BLOCKED_COPY: Record<Blocked, string> = {
  merchant_inactive: "Abonnement inactif : le mode caisse est suspendu. Contactez HyperFid.",
  too_many: "Trop de codes ouverts en même temps. Nouvel essai dans une minute…",
  error: "Connexion perdue. Nouvel essai dans quelques secondes…",
};

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The counter screen: one single-use code per customer, swapped as soon as it
 * is scanned (Realtime, with polling as a fallback) or every 2 minutes.
 */
export function CounterScreen({
  merchantId,
  merchantName,
  rewardDescription,
  brandColor,
}: {
  merchantId: string;
  merchantName: string;
  rewardDescription: string;
  brandColor: string;
}) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [served, setServed] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(true);
  const [live, setLive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentId = useRef<string | null>(null);
  const busy = useRef(false);

  const next = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result: CounterCode = await issueCounterCode().catch(() => ({ status: "error" as const }));
      if (result.status !== "ok") {
        currentId.current = null;
        setView({ kind: "blocked", reason: result.status });
        return;
      }
      const svg = await QRCode.toString(result.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      currentId.current = result.id;
      setView({ kind: "code", id: result.id, svg, rotatesAt: Date.now() + COUNTER_ROTATE_SECONDS * 1000 });
    } catch {
      currentId.current = null;
      setView({ kind: "blocked", reason: "error" });
    } finally {
      busy.current = false;
    }
  }, []);

  const onScanned = useCallback((id: string) => {
    if (id !== currentId.current) return;
    currentId.current = null;
    setServed((n) => n + 1);
    setView({ kind: "scanned" });
  }, []);

  // A fresh code whenever the screen comes back from sleep.
  useEffect(() => {
    const onVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) void next();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [next]);

  // What happens next: first code, rotate an unused code, hand over after a scan, retry errors.
  useEffect(() => {
    if (!visible) return;
    let delay: number | null = null;
    if (view.kind === "loading") delay = 0;
    else if (view.kind === "code") delay = Math.max(0, view.rotatesAt - Date.now());
    else if (view.kind === "scanned") delay = COUNTER_SCANNED_PAUSE_MS;
    else if (view.kind === "blocked" && view.reason !== "merchant_inactive") {
      delay = view.reason === "too_many" ? TOO_MANY_RETRY_MS : RETRY_MS;
    }
    if (delay === null) return;
    const id = window.setTimeout(() => void next(), delay);
    return () => window.clearTimeout(id);
  }, [view, visible, next]);

  // Countdown display.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Instant hand-off: the scan flips is_scanned on the shown code.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`counter:${merchantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qr_batches", filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const row = payload.new as { id: string; is_scanned: boolean };
          if (row.is_scanned) onScanned(row.id);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchantId, onScanned]);

  useEffect(() => {
    const supabase = createClient();
    const id = window.setInterval(
      async () => {
        const codeId = currentId.current;
        if (!codeId || document.visibilityState !== "visible") return;
        const { data } = await supabase.from("qr_batches").select("is_scanned").eq("id", codeId).maybeSingle();
        if (data?.is_scanned) onScanned(codeId);
      },
      live ? POLL_WHEN_LIVE_MS : POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [live, onScanned]);

  // Keep a tablet on the counter awake while this screen is visible.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Not allowed (battery saver, iframe…): the screen may dim, nothing else.
      }
    };
    void acquire();
    const onVisibility = () => void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  const ink = readableOn(brandColor);
  const secondsLeft = view.kind === "code" ? Math.max(0, Math.ceil((view.rotatesAt - now) / 1000)) : 0;

  return (
    <div>
      <div
        ref={rootRef}
        className={cn(
          "flex flex-col items-center gap-6 overflow-auto p-6 text-center sm:p-10",
          fullscreen ? "h-full justify-center" : "rounded-3xl",
        )}
        style={{ backgroundColor: brandColor, color: ink }}
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">{merchantName}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">Scannez et tentez votre chance</p>
          <p className="mt-2 text-base opacity-90 sm:text-lg">
            À gagner tout de suite : <span className="font-semibold">{rewardDescription}</span>
          </p>
        </div>

        <div
          aria-live="polite"
          className="flex aspect-square w-full max-w-[min(78vw,26rem)] items-center justify-center rounded-2xl bg-white p-4 text-[#0b0b0b] shadow-lg"
        >
          {view.kind === "code" ? (
            <div
              role="img"
              aria-label="QR code à scanner par le client"
              data-code-id={view.id}
              className="size-full [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: view.svg }}
            />
          ) : view.kind === "scanned" ? (
            <div className="hf-pop" role="status">
              <p className="text-6xl text-[#006300]" aria-hidden>
                ✓
              </p>
              <p className="mt-2 text-xl font-bold">Scanné ! Client suivant…</p>
            </div>
          ) : view.kind === "blocked" ? (
            <p role="alert" className="px-4 text-base font-medium">
              {BLOCKED_COPY[view.reason]}
            </p>
          ) : (
            <span role="status" aria-label="Chargement du code" className="size-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-700" />
          )}
        </div>

        <p className="min-h-5 text-sm opacity-90">
          {view.kind === "code" ? `Code à usage unique · nouveau code dans ${mmss(secondsLeft)}` : null}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => void next()}>
            Nouveau code
          </Button>
          <Button variant="secondary" onClick={toggleFullscreen}>
            {fullscreen ? "Quitter le plein écran" : "Plein écran"}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-2">
        {plural(served, "client servi", "clients servis")} sur cet écran ·{" "}
        {live ? "synchronisé en direct" : "synchronisation toutes les 3 s"}
      </p>
    </div>
  );
}
