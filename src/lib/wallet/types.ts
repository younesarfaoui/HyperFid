/** Provider-agnostic description of a HyperFid loyalty card. */
export type LoyaltyPassInput = {
  walletId: string;
  merchantName: string;
  rewardDescription: string;
  brandColor: string;
  currentStamps: number;
  stampsGoal: number;
  rewardsRedeemed: number;
  /** Public "Ma carte" page, shown on the back of the card. */
  cardUrl?: string;
};

export type PassRecord = {
  serialNumber: string;
  shareUrl: string | null;
  googleSaveUrl: string | null;
};

export interface WalletProvider {
  readonly name: string;
  createPass(input: LoyaltyPassInput): Promise<PassRecord>;
  updatePass(serialNumber: string, input: LoyaltyPassInput): Promise<void>;
}
