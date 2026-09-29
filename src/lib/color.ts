/** Picks black or white text for a solid hex background (WCAG relative luminance). */
export function readableOn(hex: string): "#ffffff" | "#0b0b0b" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  // Contrast vs white = 1.05 / (L + 0.05); vs black = (L + 0.05) / 0.05. Pick the larger.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#0b0b0b";
}

export function safeHex(hex: string | null | undefined, fallback = "#5b3df5"): string {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
}
