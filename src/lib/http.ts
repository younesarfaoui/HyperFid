/**
 * CSRF defence for state-changing Route Handlers (Server Actions get this
 * check from Next.js; Route Handlers do not). Browsers always send `Origin` on
 * cross-site POSTs, so the request is accepted only when that origin is this
 * host. Requests without `Origin` are accepted only when `Sec-Fetch-Site`
 * does not flag them as cross-site (non-browser clients send neither header).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

/**
 * Accepts only absolute http(s) URLs. Used for third-party URLs (Wallet pass
 * links) before they reach an href or a client-side redirect, so a malformed
 * or hostile value (e.g. `javascript:`) can never be navigated to.
 */
export function httpUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** ASCII-only, filesystem-safe slug for download file names. */
export function fileSlug(value: string, fallback = "export"): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}
