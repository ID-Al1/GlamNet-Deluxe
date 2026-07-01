import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type State = "loading" | "success" | "error";

export default function BookingSuccess() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [detail, setDetail] = useState<{ date: string; time: string; serviceName?: string } | null>(null);
  const [teamWarning, setTeamWarning] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const date = params.get("date") ?? "";
    const time = params.get("time") ?? "";

    if (!sessionId) {
      setState("error");
      return;
    }

    fetch(`${import.meta.env.BASE_URL}api/stripe/confirm-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to confirm booking");
        const appt = await res.json();

        // Process pending team members from a team booking (if any)
        const pending = sessionStorage.getItem("pendingTeamMembers");
        if (pending && appt.id) {
          sessionStorage.removeItem("pendingTeamMembers");
          try {
            const members = JSON.parse(pending) as {
              stylistId: string; stylistName?: string; role: string; payoutPercentage: number;
            }[];
            const results = await Promise.all(
              members.map((m) =>
                fetch(`${import.meta.env.BASE_URL}api/appointments/${appt.id}/team-members`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    stylistId: m.stylistId,
                    role: m.role,
                    payoutPercentage: m.payoutPercentage,
                  }),
                }).then((r) => ({ ok: r.ok, name: m.stylistName ?? "an artist" }))
                  .catch(() => ({ ok: false, name: m.stylistName ?? "an artist" }))
              )
            );
            const failed = results.filter((r) => !r.ok);
            if (failed.length > 0) {
              setTeamWarning(
                `Booking confirmed, but ${failed.length} team invite${failed.length > 1 ? "s" : ""} could not be sent (${failed.map((f) => f.name).join(", ")}). You can retry from your dashboard.`
              );
            }
          } catch {
            setTeamWarning("Booking confirmed, but team invites could not be sent. You can retry from your dashboard.");
          }
        }

        setDetail({ date: appt.date ?? date, time: appt.time ?? time, serviceName: appt.serviceName });
        setState("success");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-lg">Confirming your booking…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="h-14 w-14 text-destructive" />
            <h1 className="text-2xl font-serif font-bold">Booking Failed</h1>
            <p className="text-muted-foreground">
              Something went wrong confirming your booking. If payment was taken, please contact support.
            </p>
            <Button onClick={() => setLocation("/dashboard")} className="mt-2">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <h1 className="text-2xl font-serif font-bold">Booking Confirmed!</h1>
          {detail && (
            <p className="text-muted-foreground">
              {detail.serviceName && <><strong>{detail.serviceName}</strong><br /></>}
              {detail.date} at {detail.time}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Payment received. You can view your appointment in the dashboard.
          </p>
          {teamWarning && (
            <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {teamWarning}
            </p>
          )}
          <Button onClick={() => setLocation("/dashboard")} size="lg" className="mt-2 w-full">
            View Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
