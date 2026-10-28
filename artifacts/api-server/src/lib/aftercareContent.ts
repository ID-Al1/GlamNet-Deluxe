import { aftercareCategories, type AftercareBlock } from "@workspace/db";

export const MAX_BLOCKS = 60;
export const MAX_TITLE = 120;
export const MAX_HEADING = 120;
export const MAX_PARAGRAPH = 2000;
export const MAX_LIST_ITEMS = 30;
export const MAX_ITEM = 300;
export const MAX_TOTAL_CHARS = 20000;
export const MAX_URL = 300;
export const MAX_PAGES_PER_ARTIST = 100;

type Parsed =
  | { ok: true; value: { title: string; category: (typeof aftercareCategories)[number]; blocks: AftercareBlock[]; rebookingUrl: string | null } }
  | { ok: false; error: string };

// Removes control characters but keeps new lines inside paragraphs.
const clean = (value: unknown, allowNewLines = false): string => {
  if (typeof value !== "string") return "";
  const stripped = value.replace(allowNewLines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "");
  return stripped.trim();
};

/**
 * Only https links, no passwords in the address, a sensible length. Plain text
 * everywhere else, so nothing here can run as code when the page is shown.
 */
export function parseRebookingUrl(input: unknown): { ok: true; value: string | null } | { ok: false } {
  if (input === undefined || input === null) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > MAX_URL) return { ok: false };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return { ok: false };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false };
  }
}

export function parseAftercareInput(body: any): Parsed {
  const title = clean(body?.title);
  if (!title) return { ok: false, error: "Give your page a title." };
  if (title.length > MAX_TITLE) return { ok: false, error: `The title can be up to ${MAX_TITLE} characters.` };

  const category = body?.category;
  if (!aftercareCategories.includes(category)) return { ok: false, error: "Choose a service category." };

  if (!Array.isArray(body?.blocks)) return { ok: false, error: "The page content is missing." };
  if (body.blocks.length > MAX_BLOCKS) return { ok: false, error: `A page can have up to ${MAX_BLOCKS} sections.` };

  const blocks: AftercareBlock[] = [];
  let total = title.length;
  for (const raw of body.blocks) {
    if (raw?.type === "heading") {
      const text = clean(raw.text);
      if (!text) continue;
      if (text.length > MAX_HEADING) return { ok: false, error: `A heading can be up to ${MAX_HEADING} characters.` };
      total += text.length;
      blocks.push({ type: "heading", text });
    } else if (raw?.type === "paragraph") {
      const text = clean(raw.text, true);
      if (!text) continue;
      if (text.length > MAX_PARAGRAPH) return { ok: false, error: `A paragraph can be up to ${MAX_PARAGRAPH} characters.` };
      total += text.length;
      blocks.push({ type: "paragraph", text });
    } else if (raw?.type === "list") {
      if (!Array.isArray(raw.items)) return { ok: false, error: "A list needs items." };
      if (raw.items.length > MAX_LIST_ITEMS) return { ok: false, error: `A list can have up to ${MAX_LIST_ITEMS} items.` };
      const items: string[] = [];
      for (const item of raw.items) {
        const text = clean(item);
        if (!text) continue;
        if (text.length > MAX_ITEM) return { ok: false, error: `A list item can be up to ${MAX_ITEM} characters.` };
        total += text.length;
        items.push(text);
      }
      if (items.length) blocks.push({ type: "list", items });
    } else {
      return { ok: false, error: "Unknown section type." };
    }
  }
  if (total > MAX_TOTAL_CHARS) return { ok: false, error: "This page is too long. Please shorten it." };

  const url = parseRebookingUrl(body?.rebookingUrl);
  if (!url.ok) return { ok: false, error: "The booking link must start with https:// and be a real web address." };

  return { ok: true, value: { title, category, blocks, rebookingUrl: url.value } };
}
