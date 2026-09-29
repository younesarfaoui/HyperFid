import "server-only";

import { buildWalletWalletPayload } from "./pass-content";
import type { LoyaltyPassInput, PassRecord, WalletProvider } from "./types";

type CreatePassResponse = {
  serialNumber?: string;
  shareUrl?: string;
  googleSaveUrl?: string;
  applePass?: string;
};

const REQUEST_TIMEOUT_MS = 8000;

export class WalletWalletProvider implements WalletProvider {
  readonly name = "walletwallet";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://api.walletwallet.dev",
  ) {
    if (!apiKey) throw new Error("WALLETWALLET_API_KEY is required for the walletwallet provider");
  }

  private async request(path: string, method: "POST" | "PUT", body: unknown): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`WalletWallet ${method} ${path} failed: ${res.status} ${detail}`);
    }
    return res;
  }

  async createPass(input: LoyaltyPassInput): Promise<PassRecord> {
    const res = await this.request("/api/passes", "POST", buildWalletWalletPayload(input));
    const data = (await res.json()) as CreatePassResponse;

    if (!data.serialNumber) {
      throw new Error("WalletWallet response did not include a serialNumber");
    }

    return {
      serialNumber: data.serialNumber,
      shareUrl: data.shareUrl ?? null,
      googleSaveUrl: data.googleSaveUrl ?? null,
    };
  }

  async updatePass(serialNumber: string, input: LoyaltyPassInput): Promise<void> {
    await this.request(
      `/api/passes/${encodeURIComponent(serialNumber)}`,
      "PUT",
      buildWalletWalletPayload(input),
    );
  }
}
