// Mirrors `supabase gen types typescript` output for the init migration.
// Regenerate with: npx supabase gen types typescript --local > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "super_admin" | "merchant_admin";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          name: string;
          category: string;
          win_rate: number;
          reward_description: string;
          subscription_status: SubscriptionStatus;
          stamps_goal: number;
          brand_color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          win_rate?: number;
          reward_description: string;
          subscription_status?: SubscriptionStatus;
          stamps_goal?: number;
          brand_color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          win_rate?: number;
          reward_description?: string;
          subscription_status?: SubscriptionStatus;
          stamps_goal?: number;
          brand_color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          merchant_id: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          merchant_id?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          merchant_id?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      digital_wallets: {
        Row: {
          id: string;
          device_fingerprint: string;
          merchant_id: string;
          current_stamps: number;
          rewards_redeemed: number;
          last_scan_date: string | null;
          pass_serial: string | null;
          pass_share_url: string | null;
          google_save_url: string | null;
          pass_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_fingerprint: string;
          merchant_id: string;
          current_stamps?: number;
          rewards_redeemed?: number;
          last_scan_date?: string | null;
          pass_serial?: string | null;
          pass_share_url?: string | null;
          google_save_url?: string | null;
          pass_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_fingerprint?: string;
          merchant_id?: string;
          current_stamps?: number;
          rewards_redeemed?: number;
          last_scan_date?: string | null;
          pass_serial?: string | null;
          pass_share_url?: string | null;
          google_save_url?: string | null;
          pass_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "digital_wallets_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_batches: {
        Row: {
          id: string;
          merchant_id: string;
          batch_id: string;
          batch_label: string;
          is_scanned: boolean;
          scan_date: string | null;
          is_winner: boolean;
          wallet_id: string | null;
          redemption_code: string | null;
          redeemed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          batch_id: string;
          batch_label?: string;
          is_scanned?: boolean;
          scan_date?: string | null;
          is_winner?: boolean;
          wallet_id?: string | null;
          redemption_code?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          batch_id?: string;
          batch_label?: string;
          is_scanned?: boolean;
          scan_date?: string | null;
          is_winner?: boolean;
          wallet_id?: string | null;
          redemption_code?: string | null;
          redeemed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_batches_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_batches_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "digital_wallets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      qr_batch_summaries: {
        Row: {
          batch_id: string;
          merchant_id: string;
          batch_label: string;
          created_at: string;
          total: number;
          scanned: number;
          wins: number;
          redeemed: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_qr_public: {
        Args: { p_code: string };
        Returns: Json;
      };
      claim_qr_scan: {
        Args: { p_code: string; p_device_hash: string };
        Returns: Json;
      };
      generate_qr_batch: {
        Args: { p_merchant_id: string; p_quantity: number; p_label?: string };
        Returns: string;
      };
      redeem_win: {
        Args: { p_merchant_id: string; p_code: string };
        Returns: Json;
      };
      redeem_stamp_card: {
        Args: { p_wallet_id: string };
        Returns: Json;
      };
      merchant_analytics: {
        Args: { p_merchant_id: string; p_days?: number };
        Returns: Json;
      };
      platform_overview: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Merchant = Tables<"merchants">;
export type Profile = Tables<"profiles">;
export type DigitalWallet = Tables<"digital_wallets">;
export type QrCode = Tables<"qr_batches">;
export type QrBatchSummary = Database["public"]["Views"]["qr_batch_summaries"]["Row"];
