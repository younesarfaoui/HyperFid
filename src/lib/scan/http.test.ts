import { describe, expect, it } from "vitest";

import { scanHttpStatus } from "./http";

describe("scanHttpStatus", () => {
  it("maps every scan outcome to a distinct HTTP status", () => {
    expect(scanHttpStatus("ok")).toBe(200);
    expect(scanHttpStatus("invalid")).toBe(404);
    expect(scanHttpStatus("already_scanned")).toBe(409);
    expect(scanHttpStatus("merchant_inactive")).toBe(403);
    expect(scanHttpStatus("expired")).toBe(410);
    expect(scanHttpStatus("error")).toBe(502);
  });
});
