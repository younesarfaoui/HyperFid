// Shared by the proxy (issues the cookie on the scan landing GET) and the
// scan Server Action (reads it). No server-only imports: runs in both.

export const DEVICE_COOKIE = "hf_device";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400, // browser cap for persistent cookies
};

export function isValidDeviceId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}
