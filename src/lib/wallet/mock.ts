import type { LoyaltyPassInput, PassRecord, WalletProvider } from "./types";

/** Local-development provider: deterministic fake pass links, no network. */
export class MockWalletProvider implements WalletProvider {
  readonly name = "mock";

  constructor(private readonly appUrl: string) {}

  async createPass(input: LoyaltyPassInput): Promise<PassRecord> {
    const serialNumber = `mock-${input.walletId}`;
    return {
      serialNumber,
      shareUrl: `${this.appUrl}/wallet-preview/${serialNumber}`,
      googleSaveUrl: `${this.appUrl}/wallet-preview/${serialNumber}?platform=google`,
    };
  }

  async updatePass(): Promise<void> {
    // Nothing to push in mock mode.
  }
}
