import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useEffect } from "react";
import { useGetMyPayouts } from "@workspace/api-client-react";
import type { PayoutTrackerItem } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Banknote, CheckCircle2, Clock, ShieldCheck, Hourglass } from "lucide-react";

const money = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const STEPS = ["Held", "Confirmed", "Ready", "Paid"] as const;

function stepIndex(item: PayoutTrackerItem): number {
  if (item.stage === "paid") return 3;
  if (item.stage === "ready") return 2;
  if (item.stage === "held" && item.holdState === "complaint_window") return 1;
  return 0;
}

function statusLine(item: PayoutTrackerItem): string {
  switch (item.stage) {
    case "held":
      if (item.holdState === "complaint_window") {
        return item.windowEndsAt
          ? `Service complete. Your client can report a problem until ${format(new Date(item.windowEndsAt), "EEE d MMM, HH:mm")}. After that this is ready.`
          : "Service complete. Your client has 24 hours to report a problem. After that this is ready.";
      }
      if (item.holdState === "code_requested") return "Waiting for your client to give you the completion code.";
      return "Held safely. After the service, ask for the completion code in your dashboard.";
    case "in_review":
      return "Bonisa is reviewing this booking. Your money is safe.";
    case "ready":
      if (!item.dueBy) return "Ready. Bonisa will pay this in your next payout.";
      return new Date(item.dueBy).getTime() < Date.now()
        ? "This is past its payout date. Please contact Bonisa."
        : `Ready. Bonisa pays this by ${format(new Date(item.dueBy), "EEE d MMM")}.`;
    case "paid":
      return item.paidAt ? `Paid on ${format(new Date(item.paidAt), "d MMM yyyy")}.` : "Paid.";
    default:
      return "This booking was refunded to the client.";
  }
}

function StageBadge({ stage }: { stage: PayoutTrackerItem["stage"] }) {
  switch (stage) {
    case "paid":
      return <Badge className="bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/20">Paid</Badge>;
    case "ready":
      return <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">Ready</Badge>;
    case "in_review":
      return <Badge variant="outline" className="text-amber-600 border-amber-500/40">In review</Badge>;
    case "refunded":
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline">Held</Badge>;
  }
}

function StepBar({ item }: { item: PayoutTrackerItem }) {
  if (item.stage === "refunded") return null;
  const active = stepIndex(item);
  return (
    <ol className="flex items-center gap-1.5 mt-3" aria-label="Payout progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= active ? (item.stage === "in_review" ? "bg-amber-500" : "bg-primary") : "bg-border"}`} />
          <span className={`block mt-1 text-[11px] ${i <= active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Payouts() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isArtist = user?.role === "stylist";
  const { data, isLoading, isError } = useGetMyPayouts({ query: { enabled: isArtist } as any });

  useEffect(() => {
    if (user && !isArtist) navigate("/dashboard");
  }, [user, isArtist, navigate]);

  if (!isArtist) return null;

  const summary = data?.summary;
  const cards = [
    { label: "Ready to be paid", value: summary?.ready, note: "Waiting for Bonisa to pay you", icon: Banknote },
    { label: "Held for you", value: summary?.held, note: "Clients have paid. Not ready yet", icon: ShieldCheck },
    { label: "In review", value: summary?.inReview, note: "Bonisa is checking these", icon: Hourglass },
    { label: "Paid this month", value: summary?.paidThisMonth, note: summary ? `${money(summary.paidTotal)} paid in total` : "", icon: CheckCircle2 },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
        </Link>
        <h1 className="text-3xl font-serif font-bold">Where your money is</h1>
        <p className="text-sm text-muted-foreground">Amounts are your share, after Bonisa's 18% fee.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" /> {label}
              </div>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-3xl font-serif font-bold lining-nums">{money(value ?? 0)}</div>}
              <p className="text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How you get paid</h2>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Your client pays up front. Bonisa holds the money safely.</li>
          <li>After the service, you ask for a completion code. Your client gives it to you.</li>
          <li>Your client then has 24 hours to report a problem. If there is none, the money becomes <span className="text-foreground font-medium">Ready</span>.</li>
          <li>Bonisa pays your ready money to your bank account.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your bookings</h2>
        {isError && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 text-sm">We could not load your payouts. Please refresh the page.</CardContent>
          </Card>
        )}
        {isLoading && <Skeleton className="h-28 w-full" />}
        {data && data.items.length === 0 && (
          <Card className="bg-card border-border/50">
            <CardContent className="p-6 text-sm text-muted-foreground flex items-start gap-3">
              <Clock className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              No money to show yet. When a client pays for a booking, you will see it here and follow it until it reaches you.
            </CardContent>
          </Card>
        )}
        {data?.items.map((item) => (
          <Card key={`${item.appointmentId}-${item.stage}`} className="bg-card border-border/50" data-testid={`payout-${item.appointmentId}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.serviceName}</p>
                  <p className="text-xs text-muted-foreground">{item.clientName} · {format(new Date(item.date), "d MMM yyyy")} at {item.time}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-lg font-serif font-bold lining-nums">{money(item.amount)}</p>
                  <StageBadge stage={item.stage} />
                </div>
              </div>
              <StepBar item={item} />
              <p className="mt-3 text-sm text-muted-foreground">{statusLine(item)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
