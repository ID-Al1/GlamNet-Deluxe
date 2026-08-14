import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle,
  Loader2,
  XCircle,
  MessageCircle,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type State = "loading" | "success" | "error";

interface PaymentRecord {
  amount: number;
  tipAmount: number;
  depositAmount: number;
  discountAmount: number;
  couponCode: string | null;
  status: string;
}

interface BookingDetail {
  id: string;
  date: string;
  time: string;
  serviceName?: string;
  stylistName?: string;
  price?: number;
  paymentMode?: string;
  balanceDue?: number;
  payment?: PaymentRecord | null;
}

import { formatRands as formatZAR } from "@/lib/utils";

export default function BookingSuccess() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State>("loading");
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [teamWarning, setTeamWarning] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const appointmentId = params.get("appointment_id");
    const date = params.get("date") ?? "";
    const time = params.get("time") ?? "";

    // ── Pay at Appointment (no Stripe session) ──
    if (!sessionId && appointmentId) {
      const convId = params.get("conversation_id");
      if (convId) setConversationId(convId);
      const rawPrice = parseFloat(params.get("price") ?? "0");
      setDetail({
        id: appointmentId,
        date,
        time,
        serviceName: params.get("service_name") ?? undefined,
        stylistName: params.get("stylist_name") ?? undefined,
        price: rawPrice || undefined,
        paymentMode: params.get("payment_mode") ?? "pay_at_appointment",
        balanceDue: rawPrice || undefined,
      });
      setState("success");
      return;
    }

    if (!sessionId) {
      setState("error");
      return;
    }

    // ── Stripe checkout confirmed ──
    const storedAuth = localStorage.getItem("glamnet_auth");
    const authToken: string | null = storedAuth ? (() => { try { return JSON.parse(storedAuth).token ?? null; } catch { return null; } })() : null;
    const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    fetch(`${import.meta.env.BASE_URL}api/stripe/confirm-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to confirm booking");
        const appt = await res.json();

        if (appt.conversationId) setConversationId(appt.conversationId);

        // Process pending team members from a team booking (if any)
        const pending = sessionStorage.getItem("pendingTeamMembers");
        if (pending && appt.id) {
          sessionStorage.removeItem("pendingTeamMembers");
          try {
            const members = JSON.parse(pending) as {
              stylistId: string;
              stylistName?: string;
              role: string;
              payoutPercentage: number;
            }[];
            const results = await Promise.all(
              members.map((m) =>
                fetch(`${import.meta.env.BASE_URL}api/appointments/${appt.id}/team-members`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...authHeaders },
                  body: JSON.stringify({
                    stylistId: m.stylistId,
                    role: m.role,
                    payoutPercentage: m.payoutPercentage,
                  }),
                })
                  .then((r) => ({ ok: r.ok, name: m.stylistName ?? "an artist" }))
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
            setTeamWarning(
              "Booking confirmed, but team invites could not be sent. You can retry from your dashboard."
            );
          }
        }

        setDetail({
          id: appt.id,
          date: appt.date ?? date,
          time: appt.time ?? time,
          serviceName: appt.serviceName,
          stylistName: appt.stylistName,
          price: appt.price,
          paymentMode: appt.paymentMode,
          balanceDue: appt.balanceDue,
          payment: appt.payment ?? null,
        });
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
              Something went wrong confirming your booking. If payment was taken, please contact
              support.
            </p>
            <Button onClick={() => setLocation("/dashboard")} className="mt-2">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const payment = detail?.payment;
  const isPayAtAppt = detail?.paymentMode === "pay_at_appointment";
  const isDeposit = detail?.paymentMode === "deposit";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 flex flex-col items-center gap-5 text-center">
          <CheckCircle className="h-14 w-14 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-bold">Booking Confirmed</h1>
            {detail?.stylistName && (
              <p className="mt-2 font-serif italic text-3xl text-primary">
                {detail.stylistName}
              </p>
            )}
            {detail?.serviceName && (
              <p className="mt-1 font-medium">{detail.serviceName}</p>
            )}
            {detail && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {detail.date} at {detail.time}
              </p>
            )}
          </div>

          {/* Receipt breakdown */}
          {(payment || isPayAtAppt) && (
            <div className="w-full text-sm border border-border/60 rounded-xl px-4 py-3 space-y-2 text-left bg-card/50">
              {payment && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service</span>
                    <span>{formatZAR(detail?.price ?? 0)}</span>
                  </div>
                  {payment.tipAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tip</span>
                      <span>{formatZAR(payment.tipAmount)}</span>
                    </div>
                  )}
                  {payment.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Discount{payment.couponCode ? ` (${payment.couponCode})` : ""}
                      </span>
                      <span>-{formatZAR(payment.discountAmount)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold">
                    <span>{isDeposit ? "Deposit paid now" : "Total paid"}</span>
                    <span className="font-serif text-base">{formatZAR(payment.amount)}</span>
                  </div>
                  {isDeposit && (detail?.balanceDue ?? 0) > 0 && (
                    <div className="flex justify-between text-amber-600 text-xs">
                      <span>Balance due at appointment</span>
                      <span>{formatZAR(detail!.balanceDue!)}</span>
                    </div>
                  )}
                </>
              )}

              {isPayAtAppt && !payment && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Payment of {formatZAR(detail?.price ?? 0)} is due at the appointment.</span>
                </div>
              )}
            </div>
          )}

          {!payment && !isPayAtAppt && (
            <p className="text-sm text-muted-foreground">
              Payment received. A conversation with your artist is ready. Use it to coordinate any details.
            </p>
          )}

          {teamWarning && (
            <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-left w-full">
              {teamWarning}
            </p>
          )}

          <div className="w-full space-y-2">
            {conversationId && (
              <Button
                onClick={() => setLocation(`/messages?conversation=${conversationId}`)}
                size="lg"
                className="w-full gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Message your artist
              </Button>
            )}
            <Button
              onClick={() => setLocation("/payments")}
              size="lg"
              variant="outline"
              className="w-full gap-2"
            >
              <Receipt className="h-4 w-4" />
              View receipt
            </Button>
            <Button
              onClick={() => setLocation("/dashboard")}
              size="lg"
              variant="ghost"
              className="w-full"
            >
              View Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
