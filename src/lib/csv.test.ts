import { describe, expect, it } from "vitest";

import { csvEscape, scanUrl, toCsv } from "./csv";

describe("csvEscape", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(csvEscape("=HYPERLINK(\"http://evil\")")).toMatch(/^"?'=/);
    expect(csvEscape("+1")).toBe("'+1");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("renders empty cells for null and undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape(false)).toBe("false");
  });
});

describe("toCsv", () => {
  it("emits a UTF-8 BOM and CRLF rows", () => {
    const csv = toCsv(["n", "label"], [[1, "Gobelets – Lot démo"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿n,label\r\n1,Gobelets – Lot démo\r\n");
  });
});

describe("scanUrl", () => {
  it("builds the public scan URL", () => {
    expect(scanUrl("https://app.hyperfid.tn", "abc")).toBe("https://app.hyperfid.tn/s/abc");
  });
});
