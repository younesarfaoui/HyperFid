import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ScanFrame } from "@/components/scan/scan-frame";
import { StampProgress } from "@/components/scan/stamp-progress";
import { WalletButtons } from "@/components/scan/wallet-buttons";
import { readableOn, safeHex } from "@/lib/color";
import { hashDevice } from "@/lib/device";
import { DEVICE_COOKIE, isValidDeviceId } from "@/lib/device-cookie";
import { formatDate } from "@/lib/format";
import { httpUrlOrNull } from "@/lib/http";
import type { MyCard } from "@/lib/rpc-types";
import { createAnonClient } from "@/lib/supabase/anon";

export const metadata: Metadata = {
  title: "Ma carte de fidélité",
  robots: { index: false, follow: false, nocache: true },
};

type Loaded = { cards: MyCard[]; failed: boolean };

/** The cards held by this browser: the device cookie is the only credential. */
async function loadCards(): Promise<Loaded> {
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!isValidDeviceId(deviceId)) return { cards: [], failed: false };

  const { data, error } = await createAnonClient().rpc("get_my_cards", { p_device_hash: hashDevice(deviceId) });
  if (error || !Array.isArray(data)) {
    console.error("[ma-carte] get_my_cards failed:", error?.message);
    return { cards: [], failed: true };
  }
  return { cards: data as unknown as MyCard[], failed: false };
}

export default async function MyCardPage() {
  const { cards, failed } = await loadCards();

  return (
    <ScanFrame brandColor="#5b3df5" merchantName="Mes cartes de fidélité" category="HyperFid">
      {failed ? (
        <Notice title="Oups…" body="Impossible de charger vos cartes pour le moment. Réessayez dans un instant." />
      ) : cards.length === 0 ? (
        <Notice
          title="Pas encore de carte"
          body="Scannez le QR code d'un commerce HyperFid : votre carte de fidélité se crée toute seule, sans inscription."
        />
      ) : (
        <ul className="space-y-4">
          {cards.map((card, i) => (
            <li key={`${card.merchant_name}-${i}`}>
              <CardItem card={card} />
            </li>
          ))}
        </ul>
      )}
    </ScanFrame>
  );
}

function CardItem({ card }: { card: MyCard }) {
  const brandColor = safeHex(card.brand_color);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="px-4 py-3" style={{ backgroundColor: brandColor, color: readableOn(brandColor) }}>
        <p className="text-xs font-medium uppercase tracking-widest opacity-80">{card.category}</p>
        <h2 className="text-lg font-extrabold tracking-tight">{card.merchant_name}</h2>
      </header>
      <div className="space-y-4 p-4">
        <StampProgress current={card.current_stamps} goal={card.stamps_goal} brandColor={brandColor} />
        <p className="text-sm text-ink-2">
          Récompense : <span className="font-semibold text-ink">{card.reward_description}</span>
        </p>
        {card.rewards_redeemed > 0 ? (
          <p className="text-sm text-ink-2">
            Récompenses obtenues : <span className="font-semibold text-ink">{card.rewards_redeemed}</span>
          </p>
        ) : null}
        {card.last_scan_date ? (
          <p className="text-xs text-muted">Dernière visite : {formatDate(card.last_scan_date)}</p>
        ) : null}
        <WalletButtons
          shareUrl={httpUrlOrNull(card.pass_share_url)}
          googleSaveUrl={httpUrlOrNull(card.google_save_url)}
        />
      </div>
    </article>
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
