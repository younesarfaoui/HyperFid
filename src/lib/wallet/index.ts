import "server-only";

import { appUrl } from "@/lib/env";

import { MockWalletProvider } from "./mock";
import type { WalletProvider } from "./types";
import { WalletWalletProvider } from "./walletwallet";

let provider: WalletProvider | null = null;

export function getWalletProvider(): WalletProvider {
  if (provider) return provider;

  const kind = process.env.WALLET_PROVIDER ?? "mock";
  switch (kind) {
    case "walletwallet":
      provider = new WalletWalletProvider(
        process.env.WALLETWALLET_API_KEY ?? "",
        process.env.WALLETWALLET_API_URL || undefined,
      );
      break;
    case "mock":
      provider = new MockWalletProvider(appUrl());
      break;
    default:
      throw new Error(`Unknown WALLET_PROVIDER "${kind}" (expected "walletwallet" or "mock")`);
  }
  return provider;
}

export type { LoyaltyPassInput, PassRecord, WalletProvider } from "./types";
