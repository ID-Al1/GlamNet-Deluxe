import type { AftercareBlock } from "@workspace/api-client-react";

export const AFTERCARE_CATEGORY_LABELS: Record<string, string> = {
  hair: "Hair", braids: "Braids", nails: "Nails", lashes: "Lashes", makeup: "Makeup", other: "Other",
};

/** The address a client opens. Built from where Bonisa is hosted, so it works on any domain. */
export function aftercareUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}a/${token}`;
}

export function aftercareWhatsAppLink(artistName: string, token: string): string {
  const text = `Hi! Here are your aftercare instructions from ${artistName}: ${aftercareUrl(token)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** A list is edited as one point per line. */
export const listToText = (items: string[] | undefined) => (items ?? []).join("\n");
export const textToList = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

/** A block while it is being edited. For a list, `text` holds the raw lines, one point per line. */
export type EditorBlock = AftercareBlock & { key: string };
let counter = 0;
export const withKey = (blocks: AftercareBlock[]): EditorBlock[] =>
  blocks.map((b) => ({ ...b, key: `b${++counter}`, ...(b.type === "list" ? { text: listToText(b.items) } : {}) }));
export const newBlock = (type: AftercareBlock["type"]): EditorBlock => ({ key: `b${++counter}`, type, text: "" });

/** What the server and the preview get: lists become items, empty blocks are dropped. */
export function blocksToPayload(blocks: EditorBlock[]): AftercareBlock[] {
  const out: AftercareBlock[] = [];
  for (const b of blocks) {
    if (b.type === "list") {
      const items = textToList(b.text ?? "");
      if (items.length) out.push({ type: "list", items });
    } else if ((b.text ?? "").trim()) {
      out.push({ type: b.type, text: (b.text ?? "").trim() });
    }
  }
  return out;
}
