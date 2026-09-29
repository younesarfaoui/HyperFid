/**
 * Accepts only same-origin relative paths for post-login / post-confirm
 * redirects. Rejects protocol-relative (`//host`) and backslash forms
 * (`/\host`), which URL parsers normalise to another origin.
 */
export function safeRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}
