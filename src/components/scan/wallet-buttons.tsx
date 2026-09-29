"use client";

import { useSyncExternalStore } from "react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const noopSubscribe = () => () => {};

export function WalletButtons({ shareUrl, googleSaveUrl }: { shareUrl: string | null; googleSaveUrl: string | null }) {
  const platform = useSyncExternalStore<Platform>(noopSubscribe, detectPlatform, () => "other");
  const appleUrl = shareUrl;
  const googleUrl = googleSaveUrl ?? shareUrl;

  if (!appleUrl && !googleUrl) {
    return (
      <p className="rounded-lg bg-card-2 px-3 py-2 text-sm text-ink-2">
        Votre carte est bien enregistrée. L&apos;ajout au Wallet est momentanément indisponible : il sera proposé à
        votre prochain passage.
      </p>
    );
  }

  const showApple = Boolean(appleUrl) && platform !== "android";
  const showGoogle = Boolean(googleUrl) && platform !== "ios";

  return (
    <div className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col">
      {showApple ? (
        <a
          href={appleUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Ajouter à Apple Wallet
        </a>
      ) : null}
      {showGoogle ? (
        <a
          href={googleUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-[#1f1f1f] hover:bg-neutral-50"
        >
          Enregistrer dans Google Wallet
        </a>
      ) : null}
    </div>
  );
}
