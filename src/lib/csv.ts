type Cell = string | number | boolean | null | undefined;

/** RFC 4180 field escaping; also neutralises spreadsheet formula injection. */
export function csvEscape(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(","));
  // BOM so Excel opens UTF-8 (accents in labels) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function scanUrl(baseUrl: string, code: string): string {
  return `${baseUrl}/s/${code}`;
}
