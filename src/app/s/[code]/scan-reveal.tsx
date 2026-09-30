"use client";

import { useEffect, useRef, useState } from "react";

import { Confetti } from "@/components/scan/confetti";
import { LiveClock } from "@/components/scan/live-clock";
import { ScratchCard } from "@/components/scan/scratch-card";
import { StampProgress } from "@/components/scan/stamp-progress";
import { WalletButtons } from "@/components/scan/wallet-buttons";
import { Button } from "@/components/ui/button";
import { readableOn } from "@/lib/color";
import type { ScanFailureStatus, ScanOutcome, ScanSuccess } from "@/lib/scan/types";

const REDIRECT_SECONDS = 3;
const KNOWN_STATUSES = new Set<ScanOutcome["status"]>(["ok", "invalid", "already_scanned", "merchant_inactive", "error"]);

/** Claims the code through POST /api/scan/[uuid] (the only write path for a scan). */
async function requestClaim(code: string): Promise<ScanOutcome> {
  const response = await fetch(`/api/scan/${encodeURIComponent(code)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as ScanOutcome | null;
  return body && KNOWN_STATUSES.has(body.status) ? body : { status: "error" };
}

const FAILURE_COPY: Record<ScanFailureStatus, { title: string; body: string }> = {
  already_scanned: {
    title: "Code déjà utilisé",
    body: "Chaque QR code HyperFid ne peut être scanné qu'une seule fois.",
  },
  merchant_inactive: {
    title: "Programme en pause",
    body: "Ce programme de fidélité est momentanément indisponible. Votre code reste valable.",
  },
  invalid: {
    title: "QR code invalide",
    body: "Ce code n'est pas reconnu. Vérifiez que vous scannez bien un QR code HyperFid.",
  },
  error: {
    title: "Oups…",
    body: "Une erreur est survenue. Vérifiez votre connexion puis réessayez.",
  },
};

type InitialStatus = "available" | "already_scanned" | "merchant_inactive";

/**
 * The page's server status is only the *initial* state: once the visitor has
 * started a claim, local state wins, so a server re-render (e.g. after the
 * action) can never swap the result screen for "code already used".
 */
export function ScanReveal({
  code,
  brandColor,
  rewardDescription,
  initialStatus,
}: {
  code: string;
  brandColor: string;
  rewardDescription: string;
  initialStatus: InitialStatus;
}) {
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [started, setStarted] = useState(false);
  const [scratched, setScratched] = useState(false);
  const [forced, setForced] = useState(false);
  const claimStarted = useRef(false);

  async function claim() {
    if (claimStarted.current) return;
    claimStarted.current = true;
    setStarted(true);
    try {
      setOutcome(await requestClaim(code));
    } catch {
      setOutcome({ status: "error" });
    }
  }

  function revealNow() {
    setForced(true);
    void claim();
  }

  const revealed = outcome !== null && (outcome.status !== "ok" || scratched || forced);
  const ok = outcome?.status === "ok" ? outcome : null;
  const failure = outcome && outcome.status !== "ok" ? FAILURE_COPY[outcome.status] : null;

  if (!started && initialStatus !== "available") {
    const copy = FAILURE_COPY[initialStatus];
    return (
      <div className="py-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{copy.body}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-ink">Grattez pour découvrir votre surprise</h1>
        <p className="mt-1 text-sm text-ink-2">
          À gagner tout de suite : <span className="font-semibold text-ink">{rewardDescription}</span>
        </p>
      </div>
      <ScratchCard onFirstTouch={() => void claim()} onScratched={() => setScratched(true)} revealed={revealed}>
        {!outcome ? (
          <div className="flex flex-col items-center gap-2 text-sm text-neutral-500" role="status">
            <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
            Tirage en cours…
          </div>
        ) : ok?.isWinner ? (
          <div className="hf-pop">
            <p className="text-4xl" aria-hidden>
              🎉
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">Gagné !</p>
            <p className="mt-1 text-base font-medium">{ok.rewardDescription}</p>
          </div>
        ) : ok ? (
          <div className="hf-pop">
            <p className="text-2xl font-bold tracking-tight">Pas cette fois…</p>
            <p className="mt-1 text-base">
              mais <span className="font-semibold">+1 tampon</span> sur votre carte !
            </p>
          </div>
        ) : (
          <p className="text-lg font-semibold">{failure?.title}</p>
        )}
      </ScratchCard>

      {!revealed ? (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={revealNow} disabled={forced}>
            {forced ? "Tirage en cours…" : "Révéler sans gratter"}
          </Button>
        </div>
      ) : null}

      <div aria-live="polite" className="space-y-5">
        {revealed && failure ? (
          <div className="rounded-2xl border border-line bg-card p-5 text-center">
            <h2 className="text-lg font-semibold text-ink">{failure.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{failure.body}</p>
            {outcome?.status === "error" ? (
              <Button
                className="mt-4"
                onClick={() => {
                  claimStarted.current = false;
                  setOutcome(null);
                  setForced(true);
                  void claim();
                }}
              >
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : null}

        {revealed && ok ? (
          <>
            {ok.isWinner ? (
              <>
                <Confetti />
                <WinPanel outcome={ok} brandColor={brandColor} />
              </>
            ) : null}

            <div className="rounded-2xl border border-line bg-card p-5">
              {ok.isNewCustomer ? (
                <p className="mb-4 text-sm font-medium text-ink">
                  Bienvenue chez {ok.merchantName} ! Votre carte de fidélité vient d&apos;être créée.
                </p>
              ) : null}
              <StampProgress current={ok.currentStamps} goal={ok.stampsGoal} brandColor={brandColor} />
              {/* Winners stay here: their redemption code must be shown at the counter. */}
              {!ok.isWinner && ok.passUrl ? (
                <div className="mt-5">
                  <PassRedirect passUrl={ok.passUrl} />
                </div>
              ) : null}
              <div className="mt-5">
                <WalletButtons shareUrl={ok.shareUrl} googleSaveUrl={ok.googleSaveUrl} />
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                Membre {ok.memberCode} · aucune application ni inscription requise
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Sends non-winners to their Wallet pass after a short, cancellable countdown. */
function PassRedirect({ passUrl }: { passUrl: string }) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (cancelled) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [cancelled]);

  useEffect(() => {
    if (!cancelled && secondsLeft <= 0) window.location.assign(passUrl);
  }, [cancelled, secondsLeft, passUrl]);

  if (cancelled) return null;

  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
      <span>Ajout de votre carte au Wallet dans {Math.max(secondsLeft, 0)} s…</span>
      <button type="button" onClick={() => setCancelled(true)} className="shrink-0 font-medium underline">
        Rester ici
      </button>
    </div>
  );
}

function WinPanel({ outcome, brandColor }: { outcome: ScanSuccess; brandColor: string }) {
  const ink = readableOn(brandColor);
  return (
    <section
      aria-label="Votre gain"
      className="hf-live-bg rounded-2xl p-5 text-center shadow-lg"
      style={{
        color: ink,
        backgroundImage: `linear-gradient(120deg, ${brandColor}, #f5a623, ${brandColor}, #f5a623)`,
      }}
    >
      <p className="text-sm font-medium uppercase tracking-wider opacity-90">Code de retrait</p>
      <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.3em]">{outcome.redemptionCode}</p>
      <p className="mt-2 text-base font-semibold">{outcome.rewardDescription}</p>
      <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1">
        <span className="size-2 animate-pulse rounded-full bg-current" aria-hidden />
        <LiveClock />
      </div>
      <p className="mt-3 text-sm opacity-90">Montrez cet écran au comptoir pour récupérer votre récompense.</p>
    </section>
  );
}
