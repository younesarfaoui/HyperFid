// Shapes of the JSON returned by the Postgres RPCs (see supabase/migrations).

export type PublicMerchant = {
  name: string;
  category: string;
  reward_description: string;
  brand_color: string;
  stamps_goal: number;
};

export type QrPublicResult =
  | { status: "invalid" }
  | { status: "available" | "already_scanned" | "merchant_inactive"; merchant: PublicMerchant };

export type ClaimWallet = {
  id: string;
  is_new: boolean;
  current_stamps: number;
  rewards_redeemed: number;
  pass_serial: string | null;
  pass_share_url: string | null;
  google_save_url: string | null;
};

export type ClaimResult =
  | { status: "invalid" }
  | {
      status: "already_scanned" | "merchant_inactive";
      merchant: { name: string; brand_color: string };
    }
  | {
      status: "ok";
      is_winner: boolean;
      redemption_code: string | null;
      scanned_at: string;
      merchant: PublicMerchant & { id: string };
      wallet: ClaimWallet;
    };

export type RedeemWinResult =
  | { status: "not_found" }
  | {
      status: "redeemed" | "already_redeemed";
      redemption_code: string;
      scan_date: string;
      redeemed_at: string;
    };

export type RedeemStampCardResult =
  | { status: "not_found" }
  | { status: "insufficient_stamps"; current_stamps: number; stamps_goal: number }
  | { status: "redeemed"; current_stamps: number; rewards_redeemed: number; stamps_goal: number };

export type MerchantAnalytics = {
  range: { days: number; from: string; to: string };
  kpis: {
    total_customers: number;
    new_customers: number;
    active_customers: number;
    scans: number;
    returning_rate: number;
    avg_visits: number;
    wins: number;
    wins_redeemed: number;
    cards_completed: number;
    codes_total: number;
    codes_scanned: number;
  };
  daily: { day: string; new: number; returning: number; wins: number }[];
  frequency: { label: string; customers: number }[];
};

export type PlatformMerchantRow = {
  id: string;
  name: string;
  category: string;
  subscription_status: string;
  scans_30d: number;
  wins_30d: number;
  customers: number;
  codes_available: number;
};

export type PlatformOverview = {
  totals: {
    merchants: number;
    active_merchants: number;
    customers: number;
    scans_30d: number;
    wins_30d: number;
    codes_available: number;
  };
  by_status: Record<string, number>;
  merchants: PlatformMerchantRow[];
};
