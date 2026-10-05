/**
 * Bonisa branded emails.
 *
 * Every template is written once as content blocks (paragraphs, a list, a
 * button) and rendered twice: as branded HTML and as plain text, so it reads
 * properly in any inbox. Email clients ignore stylesheets and SVG, so the HTML
 * is tables with inline styles and the logo is a PNG of the canonical mark.
 *
 * Templates:
 *   verification_received — sent automatically the moment she submits
 *   profile_activated     — sent automatically when the owner verifies her
 *   checking_in           — "we have been quiet, here is your next step", worded for where she is
 *   custom                — the owner's own words, in the same branded layout
 */

export type EmailTemplateId = "verification_received" | "profile_activated" | "checking_in" | "custom";
export type EmailStage = "not_on_app" | "finishing_profile" | "waiting_review" | "live" | "suspended";

export const EMAIL_TEMPLATES: Record<EmailTemplateId, { label: string; stages: EmailStage[] }> = {
  verification_received: { label: "We received your verification", stages: ["waiting_review"] },
  profile_activated: { label: "You are verified, welcome", stages: ["live"] },
  checking_in: { label: "Checking in: finish your profile", stages: ["not_on_app", "finishing_profile", "waiting_review"] },
  custom: { label: "Your own message", stages: ["not_on_app", "finishing_profile", "waiting_review", "live"] },
};

export const ITEM_HINTS: Record<string, string> = {
  "ID number": "your South African ID number",
  "ID document": "a clear photo of your ID",
  "Bank details": "the bank account we pay your earnings into",
  "Bio": "a few sentences about you and your work",
  "Services": "at least one service with its price",
  "Portfolio": "a few photos of your best work",
};

export function appUrl() {
  const configured = process.env["PUBLIC_APP_URL"]?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const replit = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  return replit ? `https://${replit}` : "https://bonisa.co.za";
}

export interface EmailContext {
  name: string;
  email: string | null;
  stage: EmailStage;
  missing: string[];
  fromWaitlist: boolean;
  customSubject?: string;
  customBody?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

interface Content {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  list?: { title: string; items: string[] };
  after?: string[];
  button?: { label: string; url: string };
  closing?: string;
}

const C = {
  plum: "#6D1F36",
  cream: "#FDF8F0",
  ink: "#231519",
  muted: "#6B5A5F",
  gold: "#C1793A",
  line: "#EFE3D3",
  white: "#FFFFFF",
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function missingItems(missing: string[]) {
  return missing.filter((m) => m !== "Submit for verification" && m !== "Bonisa account");
}

function haveReadyList() {
  return Object.values(ITEM_HINTS).map((hint) => hint[0]!.toUpperCase() + hint.slice(1));
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

function content(id: EmailTemplateId, ctx: EmailContext): Content {
  const first = firstName(ctx.name);
  const url = appUrl();
  const items = missingItems(ctx.missing);

  switch (id) {
    case "verification_received":
      return {
        subject: "We've received your Bonisa verification",
        preheader: "Our team is verifying your details now. It takes 2 to 3 days.",
        heading: `Thank you, ${first}`,
        paragraphs: [
          "Thank you for your interest in Bonisa and for submitting your profile for verification. We have received everything, and our team is now checking your details.",
        ],
        list: {
          title: "What happens next",
          items: [
            "We check your ID, your work and your profile. This takes 2 to 3 days.",
            "We email you as soon as it is done, whatever the outcome.",
            "If anything needs changing, we tell you exactly what, so you can update it and send it back.",
          ],
        },
        after: [
          "There is nothing you need to do right now. While you wait, it is worth checking that your availability and prices are up to date, so you are ready the moment you go live.",
        ],
        button: { label: "View your profile", url: `${url}/profile` },
      };

    case "profile_activated":
      return {
        subject: `You're verified. Welcome to Bonisa, ${first}`,
        preheader: "Your profile is active. Clients can now find and book you.",
        heading: `Welcome to Bonisa, ${first}`,
        paragraphs: [
          "Thank you so much for completing your verification on Bonisa. Your profile is now active, and we're ready to get you started.",
          "Only verified artists appear on Bonisa, so your badge tells clients and brands that you are the real thing.",
        ],
        list: {
          title: "What is open to you now",
          items: [
            "Clients can find you in search and book you directly",
            "You can apply to paid brand campaigns",
            "Your verified badge shows on your profile",
          ],
        },
        after: [
          "Three things worth doing this week: make sure your availability is current, add a few more pieces to your portfolio, and share your Bonisa profile with the clients you already have.",
        ],
        button: { label: "Go to your dashboard", url: `${url}/dashboard` },
        closing: "Welcome in.",
      };

    case "checking_in":
      if (ctx.stage === "not_on_app") {
        const signUpWith = ctx.email ? `this email address (${ctx.email})` : "this phone number";
        return {
          subject: `${first}, Bonisa is ready for you`,
          preheader: "Thank you for waiting. Your next step takes a few minutes.",
          heading: `Thank you for waiting, ${first}`,
          paragraphs: [
            ctx.fromWaitlist
              ? "We know it has been a while since you joined the Bonisa waitlist, and we are sorry we have been quiet. We took our time because we wanted everything to be right before we brought you in. It is ready now."
              : "We know it has been a while since we were last in touch, and we are sorry we have been quiet. We took our time because we wanted everything to be right before we brought you in. It is ready now.",
            `Your next step is to create your free artist profile. Please sign up with ${signUpWith} so we can match you to your spot.`,
          ],
          list: { title: "It helps to have these ready", items: haveReadyList() },
          after: ["Once your profile is complete, submit it for verification and we will review it within 2 to 3 days."],
          button: { label: "Create your profile", url: `${url}/signup` },
        };
      }
      if (ctx.stage === "waiting_review") {
        return {
          subject: "An update on your Bonisa verification",
          preheader: "We are finalising your verification now.",
          heading: `Thank you for your patience, ${first}`,
          paragraphs: [
            "We are sorry we have been quiet. Your profile is with our team and we are finalising your verification now.",
            "You will hear from us within 2 to 3 days, and there is nothing more you need to do in the meantime.",
          ],
          button: { label: "View your profile", url: `${url}/profile` },
        };
      }
      return {
        subject: `${first}, let's finish your Bonisa profile`,
        preheader: items.length ? `Almost there. Still needed: ${items.join(", ")}.` : "Almost there. One last step.",
        heading: `You're nearly there, ${first}`,
        paragraphs: [
          "Thank you for signing up to Bonisa, and we are sorry we have been quiet. We have been making sure everything is ready for you, and it is.",
          items.length
            ? "Your profile is nearly complete. Clients can only find and book verified artists, so these are the last things we need from you:"
            : "Everything on your profile is filled in. The last step is to tap Submit for verification, and we will review it within 2 to 3 days.",
        ],
        list: items.length ? { title: "Still needed", items: items.map((m) => `${m}: ${ITEM_HINTS[m] ?? m}`) } : undefined,
        after: items.length ? ["Add these to your profile, then tap Submit for verification. We review every complete profile within 2 to 3 days."] : undefined,
        button: { label: "Complete your profile", url: `${url}/profile` },
      };

    case "custom": {
      const fill = (text: string) => text
        .replace(/\{first_name\}/g, first)
        .replace(/\{name\}/g, ctx.name || first)
        .replace(/\{missing_items\}/g, items.length ? items.join(", ") : "nothing, your profile is complete");
      const body = fill(ctx.customBody ?? "").trim();
      return {
        subject: fill(ctx.customSubject ?? "").trim() || "A message from Bonisa",
        preheader: body.split("\n")[0]!.slice(0, 120),
        heading: `Hi ${first}`,
        paragraphs: body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
        button: ctx.stage === "not_on_app"
          ? { label: "Create your profile", url: `${url}/signup` }
          : { label: "Open Bonisa", url: `${url}/${ctx.stage === "live" ? "dashboard" : "profile"}` },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphHtml(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.ink};">${escape(text).replace(/\n/g, "<br>")}</p>`;
}

function html(c: Content): string {
  const url = appUrl();
  const list = c.list
    ? `<p style="margin:8px 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.plum};">${escape(c.list.title)}</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">
         ${c.list.items.map((item) => `<tr>
           <td valign="top" style="width:22px;padding:0 0 10px;font-size:15px;line-height:24px;color:${C.gold};">&#9679;</td>
           <td valign="top" style="padding:0 0 10px;font-size:15px;line-height:24px;color:${C.ink};">${escape(item)}</td>
         </tr>`).join("")}
       </table>`
    : "";
  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
         <tr><td style="border-radius:10px;background:${C.plum};">
           <a href="${escape(c.button.url)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:${C.cream};text-decoration:none;border-radius:10px;">${escape(c.button.label)}</a>
         </td></tr>
       </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escape(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(c.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.cream};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
      <tr><td style="padding:0 4px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;"><img src="${url}/email-mark.png" width="34" height="34" alt="" style="display:block;border:0;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:${C.ink};">Bonisa</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.white};border:1px solid ${C.line};border-radius:16px;padding:36px 32px 20px;">
        <h1 style="margin:0 0 20px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:26px;line-height:34px;font-weight:600;color:${C.ink};">${escape(c.heading)}</h1>
        ${c.paragraphs.map(paragraphHtml).join("")}
        ${list}
        ${(c.after ?? []).map(paragraphHtml).join("")}
        ${button}
        ${c.closing ? paragraphHtml(c.closing) : ""}
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.ink};">The Bonisa team</p>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:${C.muted};text-align:center;">
        Bonisa, South Africa's verified network for beauty artists.<br>
        Questions? Just reply to this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function text(c: Content): string {
  const parts = [c.heading, "", ...c.paragraphs.flatMap((p) => [p, ""])];
  if (c.list) parts.push(c.list.title, ...c.list.items.map((i) => `  - ${i}`), "");
  for (const p of c.after ?? []) parts.push(p, "");
  if (c.button) parts.push(`${c.button.label}: ${c.button.url}`, "");
  if (c.closing) parts.push(c.closing, "");
  parts.push("The Bonisa team", "bonisa.co.za");
  return parts.join("\n");
}

export function templateAllowed(id: EmailTemplateId, stage: EmailStage) {
  return EMAIL_TEMPLATES[id].stages.includes(stage);
}

export function renderEmail(id: EmailTemplateId, ctx: EmailContext): RenderedEmail {
  const c = content(id, ctx);
  return { subject: c.subject, text: text(c), html: html(c) };
}
