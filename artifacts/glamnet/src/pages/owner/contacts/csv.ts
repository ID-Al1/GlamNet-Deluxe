/**
 * Minimal CSV reader for owner imports (waitlist exports, spreadsheets saved
 * as CSV). Handles quoted fields, escaped quotes, commas or semicolons, and
 * Windows line endings. The first row is the header.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]!;
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((cells) => Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])));
}
