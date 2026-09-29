import { describe, expect, it } from "vitest";

import { safeRelativePath } from "./safe-redirect";

describe("safeRelativePath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/auth/set-password?x=1")).toBe("/auth/set-password?x=1");
  });

  it("rejects anything that can resolve to another origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\tevil", "", null, 42]) {
      expect(safeRelativePath(bad)).toBeNull();
    }
  });

  it("really stays on the same origin once resolved", () => {
    const base = "https://app.hyperfid.tn/auth/confirm";
    for (const candidate of ["/dashboard", "/\\evil.com", "//evil.com"]) {
      const safe = safeRelativePath(candidate);
      if (safe) expect(new URL(safe, base).origin).toBe("https://app.hyperfid.tn");
    }
  });
});
