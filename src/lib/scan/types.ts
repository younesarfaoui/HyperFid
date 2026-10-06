// Client-safe types for the scan flow (shared by the API route and the scan page).

export type ScanFailureStatus = "invalid" | "already_scanned" | "merchant_inactive" | "expired" | "error";

export type ScanSuccess = {
  status: "ok";
  isWinner: boolean;
  redemptionCode: string | null;
  scannedAt: string;
  merchantName: string;
  rewardDescription: string;
  brandColor: string;
  currentStamps: number;
  stampsGoal: number;
  isNewCustomer: boolean;
  memberCode: string;
  /** Where to send the customer to add the loyalty card (null if the Wallet provider failed). */
  passUrl: string | null;
  shareUrl: string | null;
  googleSaveUrl: string | null;
};

export type ScanOutcome = { status: ScanFailureStatus } | ScanSuccess;
