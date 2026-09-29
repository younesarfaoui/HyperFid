import type { LoyaltyPassInput } from "./types";

export type PassField = { label: string; value: string; changeMessage?: string };

/** Short, human-readable member code derived from the wallet id (shown to staff). */
export function memberCode(walletId: string): string {
  return `HF-${walletId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function stampsLabel(current: number, goal: number): string {
  return `${Math.min(current, goal)} / ${goal}`;
}

/**
 * WalletWallet.dev request body for a loyalty card.
 * Docs: https://www.walletwallet.dev/docs/ — fields are shared by Apple and
 * Google passes; `changeMessage` triggers the lock-screen notification on update.
 */
export function buildWalletWalletPayload(input: LoyaltyPassInput) {
  const complete = input.currentStamps >= input.stampsGoal;

  const primaryFields: PassField[] = [
    {
      label: "TAMPONS",
      value: stampsLabel(input.currentStamps, input.stampsGoal),
      changeMessage: "Nouveau tampon : %@",
    },
  ];

  const secondaryFields: PassField[] = [
    {
      label: complete ? "CARTE COMPLÈTE" : "RÉCOMPENSE",
      value: complete ? `${input.rewardDescription} à récupérer` : input.rewardDescription,
    },
  ];

  const headerFields: PassField[] = [{ label: "MEMBRE", value: memberCode(input.walletId) }];

  const backFields: PassField[] = [
    { label: "Récompenses obtenues", value: String(input.rewardsRedeemed) },
    {
      label: "Comment ça marche",
      value: `Scannez le QR code HyperFid à chaque achat chez ${input.merchantName}. ${input.stampsGoal} tampons = ${input.rewardDescription}.`,
    },
  ];

  return {
    logoText: input.merchantName,
    description: `Carte de fidélité ${input.merchantName}`,
    barcodeValue: input.walletId,
    barcodeFormat: "QR",
    headerFields,
    primaryFields,
    secondaryFields,
    backFields,
  };
}
