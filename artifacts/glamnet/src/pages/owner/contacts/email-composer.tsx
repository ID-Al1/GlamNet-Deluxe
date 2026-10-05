import { useEffect, useState } from "react";
import { usePreviewArtistContactEmail, type ArtistContact, type ArtistContactEmailInputTemplate } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export type TemplateId = ArtistContactEmailInputTemplate;

/** Mirrors EMAIL_TEMPLATES in artifacts/api-server/src/lib/email-templates.ts. */
export const TEMPLATES: { id: TemplateId; label: string; description: string; stages: ArtistContact["stage"][] }[] = [
  {
    id: "checking_in",
    label: "Checking in: finish your profile",
    description: "Sorry we have been quiet, everything is ready, here is your next step. Worded for where she is.",
    stages: ["not_on_app", "finishing_profile", "waiting_review"],
  },
  {
    id: "verification_received",
    label: "We received your verification",
    description: "Thanks for submitting, we are verifying, it takes 2 to 3 days. Also sent automatically when she submits.",
    stages: ["waiting_review"],
  },
  {
    id: "profile_activated",
    label: "You are verified, welcome",
    description: "Thank you for completing verification, your profile is active. Also sent automatically when you verify her.",
    stages: ["live"],
  },
  {
    id: "custom",
    label: "Your own message",
    description: "Write it yourself. It goes out in the same Bonisa design, with her name filled in.",
    stages: ["not_on_app", "finishing_profile", "waiting_review", "live"],
  },
];

export function templatesFor(stage: ArtistContact["stage"]) {
  return TEMPLATES.filter((t) => t.stages.includes(stage));
}

export interface EmailDraft {
  template: TemplateId;
  subject: string;
  body: string;
}

/**
 * Pick an email, write one if it is custom, and see it exactly as the person
 * named by previewContactId will receive it.
 */
export function EmailComposer({
  templates,
  draft,
  onChange,
  previewContactId,
  previewName,
}: {
  templates: typeof TEMPLATES;
  draft: EmailDraft;
  onChange: (draft: EmailDraft) => void;
  previewContactId: string | null;
  previewName?: string;
}) {
  const preview = usePreviewArtistContactEmail();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh the preview when the choice or wording changes (debounced while typing).
  useEffect(() => {
    if (!previewContactId) { setHtml(null); return; }
    if (draft.template === "custom" && !draft.body.trim()) { setHtml(null); setError(null); return; }
    const timer = setTimeout(() => {
      preview.mutate(
        { contactId: previewContactId, data: { template: draft.template, subject: draft.subject, body: draft.body } },
        {
          onSuccess: (result) => { setHtml(result.html); setError(null); },
          onError: (err: any) => { setHtml(null); setError(err?.data?.error ?? "Could not load the preview."); },
        },
      );
    }, draft.template === "custom" ? 500 : 0);
    return () => clearTimeout(timer);
  }, [previewContactId, draft.template, draft.subject, draft.body]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {templates.map((t) => (
          <label
            key={t.id}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              draft.template === t.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
            }`}
          >
            <input
              type="radio"
              name="email-template"
              className="mt-1 accent-[hsl(var(--primary))]"
              checked={draft.template === t.id}
              onChange={() => onChange({ ...draft, template: t.id })}
            />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
            </span>
          </label>
        ))}
      </div>

      {draft.template === "custom" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email-subject">Subject</Label>
            <Input id="email-subject" maxLength={150} value={draft.subject} onChange={(e) => onChange({ ...draft, subject: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              rows={6}
              maxLength={5000}
              value={draft.body}
              onChange={(e) => onChange({ ...draft, body: e.target.value })}
              placeholder="Start straight after the greeting. 'Hi Thandi' is added for you. Leave an empty line between paragraphs."
            />
            <p className="text-xs text-muted-foreground">
              You can use {"{first_name}"} and {"{missing_items}"}, and they are filled in for each person.
            </p>
          </div>
        </div>
      )}

      {previewContactId && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview{previewName ? ` for ${previewName}` : ""}
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : html ? (
            <iframe
              title="Email preview"
              srcDoc={html}
              sandbox=""
              className="h-[520px] w-full rounded-lg border border-border/60 bg-white"
            />
          ) : draft.template === "custom" && !draft.body.trim() ? (
            <p className="text-sm text-muted-foreground">Write the message to see the preview.</p>
          ) : (
            <Skeleton className="h-[520px] w-full" />
          )}
        </div>
      )}
    </div>
  );
}
