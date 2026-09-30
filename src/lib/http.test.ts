import { describe, expect, it } from "vitest";

import { fileSlug, httpUrlOrNull, isSameOrigin } from "./http";

function req(headers: Record<string, string>) {
  return new Request("https://app.hyperfid.tn/api/scan/x", { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts requests from the app's own origin", () => {
    expect(isSameOrigin(req({ origin: "https://app.hyperfid.tn", host: "app.hyperfid.tn" }))).toBe(true);
  });

  it("uses the forwarded host behind a proxy", () => {
    expect(
      isSameOrigin(req({ origin: "https://app.hyperfid.tn", host: "internal:3000", "x-forwarded-host": "app.hyperfid.tn" })),
    ).toBe(true);
  });

  it("rejects cross-site origins", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "app.hyperfid.tn" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.hyperfid.tn.evil.example", host: "app.hyperfid.tn" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "app.hyperfid.tn" }))).toBe(false);
  });

  it("without Origin, trusts only non-cross-site fetch metadata", () => {
    expect(isSameOrigin(req({ host: "app.hyperfid.tn" }))).toBe(true);
    expect(isSameOrigin(req({ host: "app.hyperfid.tn", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ host: "app.hyperfid.tn", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ host: "app.hyperfid.tn", "sec-fetch-site": "same-site" }))).toBe(false);
  });
});

describe("httpUrlOrNull", () => {
  it("keeps http(s) URLs", () => {
    expect(httpUrlOrNull("https://api.walletwallet.dev/p/SN-1")).toBe("https://api.walletwallet.dev/p/SN-1");
    expect(httpUrlOrNull("http://localhost:3000/wallet-preview/x")).toBe("http://localhost:3000/wallet-preview/x");
  });

  it("drops anything that could execute or is malformed", () => {
    expect(httpUrlOrNull("javascript:alert(1)")).toBeNull();
    expect(httpUrlOrNull("data:text/html,<script>x</script>")).toBeNull();
    expect(httpUrlOrNull("/relative")).toBeNull();
    expect(httpUrlOrNull("")).toBeNull();
    expect(httpUrlOrNull(null)).toBeNull();
  });
});

describe("fileSlug", () => {
  it("makes ASCII file-name slugs", () => {
    expect(fileSlug("Mandy Coffee Shop")).toBe("mandy-coffee-shop");
    expect(fileSlug("Pâtisserie « Élysée » & Co")).toBe("patisserie-elysee-co");
    expect(fileSlug("***", "commerce")).toBe("commerce");
  });
});
