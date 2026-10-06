import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BALANCE_DAYS_BEFORE_EVENT, BRAND_FEE_PERCENT, addDaysSA, campaignQuote, daysFromToday, rand, randWhole, todaySA } from "@/lib/campaign-money";

const SPECIALTIES = ["Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

export interface CampaignFormValues {
  title: string;
  brief: string;
  specialty: string;
  artistsNeeded: number;
  ratePerArtist: number;
  eventDate: string;
  eventTime: string;
  location: string;
  deadline: string;
}

export const emptyCampaign: CampaignFormValues = {
  title: "",
  brief: "",
  specialty: "Makeup",
  artistsNeeded: 2,
  ratePerArtist: 0,
  eventDate: "",
  eventTime: "09:00",
  location: "",
  deadline: "",
};

/**
 * Create or edit a campaign. The box at the bottom shows the brand exactly what it will pay,
 * with Bonisa's fee in plain sight, before it commits to anything.
 */
export function CampaignForm({
  initial,
  submitLabel,
  isPending,
  lockedMoney,
  onSubmit,
}: {
  initial?: Partial<CampaignFormValues>;
  submitLabel: string;
  isPending: boolean;
  /** Artists have accepted, so the rate, date, time and place can no longer change. */
  lockedMoney?: boolean;
  onSubmit: (values: CampaignFormValues) => void;
}) {
  const [v, setV] = useState<CampaignFormValues>({ ...emptyCampaign, ...initial });
  const set = <K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) => setV((p) => ({ ...p, [key]: value }));
  const [error, setError] = useState<string | null>(null);

  const rate = Number.isFinite(v.ratePerArtist) ? v.ratePerArtist : 0;
  const artists = Number.isFinite(v.artistsNeeded) ? v.artistsNeeded : 0;
  const quote = rate > 0 && artists > 0 ? campaignQuote(rate, artists) : null;
  const days = v.eventDate ? daysFromToday(v.eventDate) : null;
  const payInFull = days !== null && days <= BALANCE_DAYS_BEFORE_EVENT;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (v.title.trim().length < 3) return setError("Give the campaign a title.");
    if (v.brief.trim().length < 10) return setError("Tell the artists a little more in the brief.");
    if (!Number.isInteger(rate) || rate < 1) return setError("Enter what each artist is paid, in whole rand.");
    if (!Number.isInteger(artists) || artists < 1) return setError("Enter how many artists you need.");
    if (!v.eventDate) return setError("Choose the event date.");
    if (!v.deadline) return setError("Choose when applications close.");
    if (v.location.trim().length < 2) return setError("Say where the shoot is.");
    setError(null);
    onSubmit({ ...v, title: v.title.trim(), brief: v.brief.trim(), location: v.location.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-5 pt-2">
      <div className="space-y-2">
        <Label htmlFor="c-title">Campaign title</Label>
        <Input id="c-title" placeholder="e.g. Autumn lookbook shoot" value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-brief">Brief</Label>
        <Textarea id="c-brief" rows={4} placeholder="What you need, the look, and anything artists should bring." value={v.brief} onChange={(e) => set("brief", e.target.value)} className="resize-none" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Artist type</Label>
          <Select value={v.specialty} onValueChange={(s) => set("specialty", s)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-artists">How many artists</Label>
          <Input id="c-artists" type="number" min={1} max={50} value={v.artistsNeeded || ""} onChange={(e) => set("artistsNeeded", Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-rate">Paid to each artist (R)</Label>
          <Input id="c-rate" type="number" min={1} step={1} placeholder="3000" value={v.ratePerArtist || ""} disabled={lockedMoney} onChange={(e) => set("ratePerArtist", Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="c-date">Event date</Label>
          <Input id="c-date" type="date" min={addDaysSA(todaySA(), 1)} value={v.eventDate} disabled={lockedMoney} onChange={(e) => set("eventDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-time">Start time</Label>
          <Input id="c-time" type="time" value={v.eventTime} disabled={lockedMoney} onChange={(e) => set("eventTime", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-deadline">Applications close</Label>
          <Input id="c-deadline" type="date" min={todaySA()} max={v.eventDate || undefined} value={v.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-location">Where</Label>
        <Input id="c-location" placeholder="Studio or venue, and suburb" value={v.location} maxLength={200} disabled={lockedMoney} onChange={(e) => set("location", e.target.value)} />
      </div>
      {lockedMoney && (
        <p className="text-xs text-muted-foreground">Artists have already accepted, so the rate, date, time and place are locked. You can still change the title, brief and deadline.</p>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2" data-testid="campaign-quote">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What this costs you</p>
        {quote ? (
          <>
            <div className="flex justify-between text-sm"><span>{artists} {artists === 1 ? "artist" : "artists"} x {randWhole(rate)}</span><span>{rand(quote.artistFees)}</span></div>
            <div className="flex justify-between text-sm"><span>Bonisa fee ({BRAND_FEE_PERCENT}%)</span><span>{rand(quote.fee)}</span></div>
            <div className="flex justify-between border-t border-border/60 pt-2 font-semibold"><span>Total</span><span>{rand(quote.total)}</span></div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {payInFull
                ? "Your event is less than 3 days away, so the full amount is paid when you confirm your team."
                : `Pay half (${rand(quote.deposit)}) when you confirm your team, and the other half (${rand(quote.balance)}) ${BALANCE_DAYS_BEFORE_EVENT} days before the event.`}
              {" "}Your artists keep their full {randWhole(rate)} each. The fee is paid on top by you, never taken off them.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Enter how many artists and what each is paid to see your total.</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" className="h-11 w-full rounded-full" disabled={isPending}>{isPending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
