// "Mode caisse": single-use QR codes shown on the merchant's own screen.
// Client-safe (shared by the Server Action and the counter screen).

/** How often the counter screen swaps its code when nobody scans it. */
export const COUNTER_ROTATE_SECONDS = 120;

/** How long "✓ Scanné" stays on screen before the next customer's code. */
export const COUNTER_SCANNED_PAUSE_MS = 3000;

export type CounterCode =
  | { status: "ok"; id: string; url: string; expiresAt: string }
  | { status: "merchant_inactive" | "too_many" | "error" };
