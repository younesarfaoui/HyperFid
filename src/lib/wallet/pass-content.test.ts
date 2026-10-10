import { describe, expect, it } from "vitest";

import { buildWalletWalletPayload, memberCode, stampsLabel } from "./pass-content";

const base = {
  walletId: "0f3c9a1e-2b4d-4e6f-8a1b-3c5d7e9f1a2b",
  merchantName: "Mandy Coffee Shop",
  rewardDescription: "1 Café Express gratuit",
  brandColor: "#6F4E37",
  currentStamps: 3,
  stampsGoal: 10,
  rewardsRedeemed: 0,
};

describe("memberCode", () => {
  it("derives a short uppercase code from the wallet id", () => {
    expect(memberCode(base.walletId)).toBe("HF-0F3C9A1E");
  });
});

describe("stampsLabel", () => {
  it("caps the displayed count at the goal", () => {
    expect(stampsLabel(3, 10)).toBe("3 / 10");
    expect(stampsLabel(12, 10)).toBe("10 / 10");
  });
});

describe("buildWalletWalletPayload", () => {
  it("maps a loyalty card to WalletWallet fields", () => {
    const payload = buildWalletWalletPayload(base);
    expect(payload.logoText).toBe("Mandy Coffee Shop");
    expect(payload.barcodeValue).toBe(base.walletId);
    expect(payload.primaryFields[0]).toMatchObject({ label: "TAMPONS", value: "3 / 10" });
    expect(payload.primaryFields[0].changeMessage).toContain("%@");
    expect(payload.secondaryFields[0]).toMatchObject({ label: "RÉCOMPENSE", value: "1 Café Express gratuit" });
    expect(payload.headerFields[0].value).toBe("HF-0F3C9A1E");
  });

  it("shows how many stamps are left before the reward", () => {
    const payload = buildWalletWalletPayload(base);
    expect(payload.secondaryFields[1]).toMatchObject({ label: "ENCORE", value: "7 tampons" });
    expect(buildWalletWalletPayload({ ...base, currentStamps: 9 }).secondaryFields[1].value).toBe("1 tampon");
  });

  it("prints the online card link on the back, when known", () => {
    expect(buildWalletWalletPayload(base).backFields.map((f) => f.label)).not.toContain("Ma carte en ligne");
    const withLink = buildWalletWalletPayload({ ...base, cardUrl: "https://app.hyperfid.tn/ma-carte" });
    expect(withLink.backFields).toContainEqual({ label: "Ma carte en ligne", value: "https://app.hyperfid.tn/ma-carte" });
  });

  it("announces a completed card", () => {
    const payload = buildWalletWalletPayload({ ...base, currentStamps: 10 });
    expect(payload.secondaryFields[0].label).toBe("CARTE COMPLÈTE");
    expect(payload.secondaryFields[0].value).toContain("à récupérer");
    expect(payload.secondaryFields).toHaveLength(1);
  });

  it("never leaks the device fingerprint or internal ids beyond the wallet id", () => {
    const serialized = JSON.stringify(buildWalletWalletPayload(base));
    expect(serialized).not.toMatch(/fingerprint|merchant_id|device/i);
  });
});
