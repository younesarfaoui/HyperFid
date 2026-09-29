import { describe, expect, it } from "vitest";

import { hashDevice, isValidDeviceId } from "./device";

const SECRET = "a".repeat(64);

describe("hashDevice", () => {
  it("produces the 64-char lowercase hex the database CHECK expects", () => {
    const hash = hashDevice("6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70", SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic per device and secret", () => {
    const id = "6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70";
    expect(hashDevice(id, SECRET)).toBe(hashDevice(id, SECRET));
    expect(hashDevice(id, SECRET)).not.toBe(hashDevice(id, "b".repeat(64)));
    expect(hashDevice(id, SECRET)).not.toBe(hashDevice("0d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70", SECRET));
  });

  it("refuses to run without a strong secret", () => {
    const previous = process.env.DEVICE_HASH_SECRET;
    process.env.DEVICE_HASH_SECRET = "short";
    expect(() => hashDevice("6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70")).toThrow(/DEVICE_HASH_SECRET/);
    process.env.DEVICE_HASH_SECRET = previous;
  });
});

describe("isValidDeviceId", () => {
  it("accepts v4 UUIDs only", () => {
    expect(isValidDeviceId("6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70")).toBe(true);
    expect(isValidDeviceId(undefined)).toBe(false);
    expect(isValidDeviceId("not-a-uuid")).toBe(false);
    expect(isValidDeviceId("6d9a3c52-1f0e-1b7a-9c3d-2a5e8f1b4c70")).toBe(false);
    expect(isValidDeviceId("6d9a3c52-1f0e-4b7a-9c3d-2a5e8f1b4c70; admin=1")).toBe(false);
  });
});
