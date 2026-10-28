import type { AftercareBlock } from "@workspace/db";

/**
 * Starting points an artist can edit. They are general guidance only: the artist
 * is responsible for reviewing every word before she publishes, and she must tick
 * that she has done so. Keep the wording plain, and keep medical claims out of it.
 */
export interface AftercareTemplate {
  category: "hair" | "braids" | "nails" | "lashes" | "makeup" | "other";
  title: string;
  blocks: AftercareBlock[];
}

const seeSomeone: AftercareBlock[] = [
  { type: "heading", text: "If something does not feel right" },
];

export const AFTERCARE_TEMPLATES: AftercareTemplate[] = [
  {
    category: "braids",
    title: "Braids aftercare",
    blocks: [
      { type: "heading", text: "The first days" },
      { type: "list", items: [
        "Keep your braids and scalp dry for the first 24 hours unless your artist told you otherwise.",
        "Sleep with a satin or silk scarf or bonnet to protect your style.",
        "Avoid tight ponytails or pulling your braids.",
      ] },
      { type: "heading", text: "Day to day" },
      { type: "list", items: [
        "Moisturise your scalp lightly. A small amount is enough, too much product builds up.",
        "Wash your scalp gently every one to two weeks, and dry your braids fully afterwards.",
        "Scratch gently with the pads of your fingers, not your nails.",
      ] },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Your artist will tell you when to refresh or remove your braids. Book your next visit early so you get the time you want." },
      ...seeSomeone,
      { type: "paragraph", text: "If you have pain, swelling, a rash or a sore scalp that does not settle, tell your artist and speak to a health professional." },
    ],
  },
  {
    category: "hair",
    title: "Hair aftercare",
    blocks: [
      { type: "heading", text: "The first days" },
      { type: "list", items: [
        "Follow the wash and care routine your artist gave you.",
        "Use heat protection before you style with heat.",
        "Be gentle when you brush, starting at the ends.",
      ] },
      { type: "heading", text: "Day to day" },
      { type: "list", items: [
        "Sleep with a satin or silk scarf, bonnet or pillowcase.",
        "Use products your artist recommended, and ask before you try new ones.",
      ] },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Ask your artist how often to come back for your style. Book early." },
      ...seeSomeone,
      { type: "paragraph", text: "If your scalp becomes sore, itchy or irritated, stop using the product and tell your artist. See a health professional if it does not settle." },
    ],
  },
  {
    category: "nails",
    title: "Nails aftercare",
    blocks: [
      { type: "heading", text: "The first day" },
      { type: "list", items: [
        "Avoid very hot water and heavy cleaning without gloves.",
        "Do not use your nails as tools to open or scrape things.",
      ] },
      { type: "heading", text: "Day to day" },
      { type: "list", items: [
        "Use cuticle oil every day.",
        "Do not peel or pick off the product. It can damage your natural nail.",
        "Wear gloves for dishes and cleaning.",
      ] },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Book a fill or a safe removal with your artist. Please do not remove them yourself." },
      ...seeSomeone,
      { type: "paragraph", text: "If a nail lifts, or you notice pain, swelling or redness around it, tell your artist. See a health professional if you think it is infected." },
    ],
  },
  {
    category: "lashes",
    title: "Lash aftercare",
    blocks: [
      { type: "heading", text: "The first 24 hours" },
      { type: "list", items: [
        "Keep your lashes dry. Avoid steam, saunas and heavy sweating.",
        "Do not touch, pick or pull your lashes.",
      ] },
      { type: "heading", text: "Day to day" },
      { type: "list", items: [
        "Brush gently with a clean lash brush.",
        "Keep oil-based products away from your lashes.",
        "Sleep on your back if you can.",
      ] },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Your artist will tell you when to come back for a refill. Book early." },
      ...seeSomeone,
      { type: "paragraph", text: "If your eyes become red, sore or swollen, stop and tell your artist straight away, and speak to a health professional." },
    ],
  },
  {
    category: "makeup",
    title: "Makeup aftercare",
    blocks: [
      { type: "heading", text: "On the day" },
      { type: "list", items: [
        "Avoid touching your face, and blot instead of rubbing.",
        "Stay out of steam and heavy rain if you can.",
      ] },
      { type: "heading", text: "At the end of the day" },
      { type: "list", items: [
        "Remove your makeup gently with a cleanser.",
        "Moisturise your skin afterwards.",
      ] },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Book your next event or touch-up early so your artist has time for you." },
      ...seeSomeone,
      { type: "paragraph", text: "If your skin becomes red, itchy or irritated, wash the product off and tell your artist. See a health professional if it does not settle." },
    ],
  },
  {
    category: "other",
    title: "Aftercare",
    blocks: [
      { type: "heading", text: "After your appointment" },
      { type: "paragraph", text: "Write the most important thing your client should do in the first days." },
      { type: "heading", text: "Coming back" },
      { type: "paragraph", text: "Tell your client when to book again." },
    ],
  },
];
