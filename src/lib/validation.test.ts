import { describe, expect, it } from "vitest";

import { readableOn, safeHex } from "./color";
import {
  batchCreateSchema,
  inviteSchema,
  merchantCreateSchema,
  merchantSettingsSchema,
  passwordSchema,
  redemptionCodeSchema,
} from "./validation";

describe("redemptionCodeSchema", () => {
  it("normalises case and whitespace", () => {
    expect(redemptionCodeSchema.parse("  abc234 ")).toBe("ABC234");
  });

  it("rejects ambiguous characters and wrong lengths", () => {
    expect(redemptionCodeSchema.safeParse("ABCIO0").success).toBe(false);
    expect(redemptionCodeSchema.safeParse("ABC23").success).toBe(false);
    expect(redemptionCodeSchema.safeParse("ABC2345").success).toBe(false);
  });
});

describe("merchantCreateSchema", () => {
  const valid = {
    name: "Mandy Coffee Shop",
    category: "Cafe",
    win_rate: "10",
    reward_description: "1 Café Express gratuit",
    subscription_status: "active",
    stamps_goal: "10",
    brand_color: "#6f4e37",
  };

  it("coerces form strings", () => {
    const parsed = merchantCreateSchema.parse(valid);
    expect(parsed.win_rate).toBe(10);
    expect(parsed.stamps_goal).toBe(10);
  });

  it("enforces the same bounds as the database", () => {
    expect(merchantCreateSchema.safeParse({ ...valid, win_rate: "101" }).success).toBe(false);
    expect(merchantCreateSchema.safeParse({ ...valid, win_rate: "-1" }).success).toBe(false);
    expect(merchantCreateSchema.safeParse({ ...valid, stamps_goal: "0" }).success).toBe(false);
    expect(merchantCreateSchema.safeParse({ ...valid, subscription_status: "free" }).success).toBe(false);
    expect(merchantCreateSchema.safeParse({ ...valid, brand_color: "red" }).success).toBe(false);
  });
});

describe("merchantSettingsSchema", () => {
  it("strips fields merchants may not edit", () => {
    const parsed = merchantSettingsSchema.parse({
      reward_description: "1 Cappuccino",
      stamps_goal: "8",
      brand_color: "#112233",
      win_rate: "99",
      subscription_status: "active",
    });
    expect(parsed).toEqual({ reward_description: "1 Cappuccino", stamps_goal: 8, brand_color: "#112233" });
  });
});

describe("batchCreateSchema", () => {
  it("caps batch size at 5000", () => {
    const merchant_id = "6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70";
    expect(batchCreateSchema.safeParse({ merchant_id, quantity: "5000" }).success).toBe(true);
    expect(batchCreateSchema.safeParse({ merchant_id, quantity: "5001" }).success).toBe(false);
    expect(batchCreateSchema.safeParse({ merchant_id: "x", quantity: "10" }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("normalises e-mails before validating", () => {
    const parsed = inviteSchema.parse({
      merchant_id: "6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70",
      email: "  Mandy@Example.TN ",
    });
    expect(parsed.email).toBe("mandy@example.tn");
  });
});

describe("passwordSchema", () => {
  it("requires matching passwords of 10+ chars", () => {
    expect(passwordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "long-enough-1", confirm: "different-1" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "long-enough-1", confirm: "long-enough-1" }).success).toBe(true);
  });
});

describe("color helpers", () => {
  it("picks readable text on brand colors", () => {
    expect(readableOn("#6F4E37")).toBe("#ffffff");
    expect(readableOn("#FFE45C")).toBe("#0b0b0b");
  });

  it("falls back on invalid hex", () => {
    expect(safeHex("javascript:alert(1)")).toBe("#5b3df5");
    expect(safeHex("#abcdef")).toBe("#abcdef");
  });
});
