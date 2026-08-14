import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Receipt, RefreshCw, ExternalLink, AlertCircle, Loader2, ArrowLeft, RotateCcw, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PaymentRecord {
  id: string;
  appointmentId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  tipAmount: number;
  depositAmount: number;
  discountAmount: number;
  couponCode: string | null;
  refundedAmount: number;
  status: "succeeded" | "refunded" | "partial_refunded" | "failed" | "pending";
  createdAt: string;
}

interface AppointmentWithPayment {
  id: string;
  stylistName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  price: number;
  paymentMode: string;
  depositAmount: number;
  tipAmount: number;
  balanceDue: number;
  stripeSessionId: string | null;
  createdAt: string;
  payment: PaymentRecord | null;
}

function paymentStatusBadge(appt: AppointmentWithPayment) {
  if (appt.paymentMode === "pay_at_appointment") {
    return <Badge variant="outline" className="text-xs">Pay at Appointment</Badge>;
  }
  if (!appt.payment) return <Badge variant="outline" className="text-xs text-muted-foreground">No record</Badge>;
  switch (appt.payment.status) {
    case "succeeded":
      return <Badge className="text-xs bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/20">Paid</Badge>;
    case "refunded":
      return <Badge variant="secondary" className="text-xs">Refunded</Badge>;
    case "partial_refunded":
      return <Badge variant="secondary" className="text-xs">Partial Refund</Badge>;
    case "failed":
      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{appt.payment.status}</Badge>;
  }
}

function formatZAR(amount: number) {
  return `R${amount.toFixed(2)}`;
}

export default function PaymentHistory() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [items, setItems] = useState<AppointmentWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<AppointmentWithPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPending, setRefundPending] = useState(false);

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Stable idempotency key per refund dialog open — reused on any network retry
  // of the same refund action, preventing duplicate refunds.
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState<string>("");
  const [retryPending, setRetryPending] = useState(false);

  function openRefundDialog(appt: AppointmentWithPayment) {
    setRefundTarget(appt);
    setRefundAmount("");
    setRefundIdempotencyKey(crypto.randomUUID());
  }

  async function retryPayment(appt: AppointmentWithPayment) {
    setRetryPending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/retry-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ appointmentId: appt.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Could not start payment retry.");
    } finally {
      setRetryPending(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/payments`, {
        headers: { ...authHeader },
      });
      if (!res.ok) throw new Error("Failed to load");
      setItems(await res.json());
    } catch {
      toast.error("Could not load payment history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function openReceipt(appt: AppointmentWithPayment) {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/stripe/payments/${appt.id}/receipt`,
        { headers: { ...authHeader } }
      );
      if (!res.ok) throw new Error("Could not load receipt");
      const data = await res.json();
      if (data.hostedReceiptUrl) {
        window.open(data.hostedReceiptUrl, "_blank", "noopener");
      } else {
        toast.info("Stripe receipt not available for this payment.");
      }
    } catch {
      toast.error("Could not open receipt.");
    }
  }

  async function submitRefund() {
    if (!refundTarget) return;
    setRefundPending(true);
    try {
      const body: any = {
        appointmentId: refundTarget.id,
        idempotencyKey: refundIdempotencyKey, // stable per-dialog-open; safe to retry
      };
      const amt = parseFloat(refundAmount);
      if (refundAmount && !isNaN(amt) && amt > 0) body.amount = amt;

      const res = await fetch(`${import.meta.env.BASE_URL}api/stripe/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");

      toast.success(
        data.isFullRefund
          ? `Full refund of ${formatZAR(data.refundedAmount)} issued.`
          : `Partial refund of ${formatZAR(data.refundedAmount)} issued.`
      );
      setRefundTarget(null);
      setRefundAmount("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Refund failed. Please try again.");
    } finally {
      setRefundPending(false);
    }
  }

  const canRefund = (appt: AppointmentWithPayment) => {
    if (!appt.payment) return false;
    if (appt.paymentMode === "pay_at_appointment") return false;
    if (appt.payment.status === "refunded") return false;
    if (!appt.payment.stripePaymentIntentId) return false;
    const refundable = appt.payment.amount - (appt.payment.refundedAmount ?? 0);
    return refundable > 0;
  };

  return (
    <div className="container py-8 sm:py-12 max-w-3xl space-y-6 px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-serif font-bold">Payment History</h1>
          <p className="text-sm text-muted-foreground">All your bookings and transactions</p>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 opacity-30" />
            <p className="font-medium">No payments yet</p>
            <p className="text-sm">Your payment history will appear here after your first booking.</p>
            <Button variant="outline" className="mt-2" onClick={() => setLocation("/stylists")}>
              Find an artist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((appt) => {
            const payment = appt.payment;
            const paid = payment?.amount ?? 0;
            const refunded = payment?.refundedAmount ?? 0;
            const net = paid - refunded;
            return (
              <Card key={appt.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{appt.serviceName}</p>
                      <p className="text-sm text-muted-foreground">
                        with {appt.stylistName} · {appt.date} at {appt.time}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {paymentStatusBadge(appt)}
                      <span className="font-serif font-bold text-lg">
                        {appt.paymentMode === "pay_at_appointment" ? formatZAR(appt.price) : formatZAR(net)}
                      </span>
                    </div>
                  </div>

                  {payment && (
                    <div className="text-xs text-muted-foreground space-y-1 border-t border-border/50 pt-3">
                      <div className="flex justify-between">
                        <span>Service</span>
                        <span>{formatZAR(appt.price)}</span>
                      </div>
                      {payment.tipAmount > 0 && (
                        <div className="flex justify-between">
                          <span>Tip</span>
                          <span>{formatZAR(payment.tipAmount)}</span>
                        </div>
                      )}
                      {payment.discountAmount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount {payment.couponCode ? `(${payment.couponCode})` : ""}</span>
                          <span>-{formatZAR(payment.discountAmount)}</span>
                        </div>
                      )}
                      {appt.paymentMode === "deposit" && appt.balanceDue > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Balance due at appointment</span>
                          <span>{formatZAR(appt.balanceDue)}</span>
                        </div>
                      )}
                      {refunded > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Refunded</span>
                          <span>-{formatZAR(refunded)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/30">
                        <span>Total charged</span>
                        <span>{formatZAR(paid)}</span>
                      </div>
                    </div>
                  )}

                  {appt.paymentMode === "pay_at_appointment" && (
                    <div className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                      <p className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        Payment due at the appointment — {formatZAR(appt.price)}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {payment && appt.paymentMode !== "pay_at_appointment" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => openReceipt(appt)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    )}
                    {canRefund(appt) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => openRefundDialog(appt)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refund
                      </Button>
                    )}
                    {appt.payment?.status === "failed" && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => retryPayment(appt)}
                        disabled={retryPending}
                      >
                        {retryPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCcw className="h-3.5 w-3.5" />}
                        Retry Payment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!refundTarget} onOpenChange={(open) => { if (!open) setRefundTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              {refundTarget && (
                <>
                  Refunding payment for <strong>{refundTarget.serviceName}</strong> with {refundTarget.stylistName}.
                  {" "}Paid: {formatZAR(refundTarget.payment?.amount ?? 0)},
                  {" "}already refunded: {formatZAR(refundTarget.payment?.refundedAmount ?? 0)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Refund amount (ZAR)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder={`Leave blank for full refund (${formatZAR(
                  (refundTarget?.payment?.amount ?? 0) - (refundTarget?.payment?.refundedAmount ?? 0)
                )})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to refund the full remaining amount.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refundPending}>
              Cancel
            </Button>
            <Button onClick={submitRefund} disabled={refundPending}>
              {refundPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
