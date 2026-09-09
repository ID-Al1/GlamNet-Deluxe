import { useState } from "react";
import { useGetOwnerPaymentsOverview } from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  ChevronDown, 
  ChevronUp, 
  ListTree,
  AlertCircle,
  Receipt,
  User,
  Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { OwnerPaymentOverview } from "@workspace/api-client-react";

function PaymentOverviewItem({ item }: { item: OwnerPaymentOverview }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getLedgerStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "due": return "secondary";
      case "reversed": return "destructive";
      default: return "outline";
    }
  };

  return (
    <Card className="bg-card border-border/60 shadow-sm overflow-hidden mb-4">
      <div 
        className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col gap-1.5 md:w-1/3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{item.clientName || 'Unknown Client'}</span>
            <span className="text-muted-foreground text-xs mx-1">•</span>
            <span className="text-muted-foreground text-sm truncate">{item.serviceName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
              {item.appointmentId.slice(0, 8)}
            </span>
            <span>{item.date ? format(new Date(item.date), "dd MMM yyyy") : 'Unknown date'}</span>
          </div>
        </div>

        <div className="flex flex-row md:flex-row items-center gap-6 justify-between md:w-2/3 md:justify-end">
          <div className="flex gap-6 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium">R {item.artistPool.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Artist Pool</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">R {item.platformFeeAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</p>
              <p className="text-xs text-muted-foreground">Platform Fee</p>
            </div>
            <div>
              <p className="text-lg font-serif">R {item.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Gross</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize">
              {item.payoutStatus}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
              {isExpanded ? <ChevronUp className="h-5 w-5" strokeWidth={1.9} /> : <ChevronDown className="h-5 w-5" strokeWidth={1.9} />}
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/40 bg-muted/5 p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ListTree className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
            <h4 className="text-sm font-medium">Ledger Breakdown</h4>
            {item.isTeamBooking && (
              <Badge variant="secondary" className="ml-2 text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 flex items-center gap-1">
                <Users className="h-3 w-3" strokeWidth={1.9} /> Team Booking
              </Badge>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase border-b border-border/40">
                <tr>
                  <th className="pb-2 font-medium">Artist</th>
                  <th className="pb-2 font-medium text-right">Share</th>
                    <th className="pb-2 font-medium text-right">Pool share</th>
                    <th className="pb-2 font-medium text-right">Fee attribution</th>
                    <th className="pb-2 font-medium text-right">Amount owed</th>
                  <th className="pb-2 font-medium pl-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {item.ledger.length > 0 ? (
                  item.ledger.map((line, idx) => (
                    <tr key={`${item.appointmentId}-line-${idx}`} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                            <User className="h-3 w-3" strokeWidth={1.9} />
                          </div>
                          <span className="font-medium truncate max-w-[120px]">{line.artistName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">{line.sharePercent}%</td>
                      <td className="py-3 text-right">R {line.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right text-muted-foreground">R {line.platformFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right font-medium">R {line.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 pl-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={getLedgerStatusColor(line.status)} className="capitalize text-[10px] h-5 py-0 px-1.5">
                            {line.status}
                          </Badge>
                          {line.paidAt && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(line.paidAt), "MMM d, HH:mm")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                      No ledger entries found for this booking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function OwnerPaymentsOverview() {
  const { data, isLoading, error } = useGetOwnerPaymentsOverview();

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="font-serif text-3xl mb-2">Ledger Overview</h1>
        <p className="text-sm text-muted-foreground">
          Inspect booking payout statuses and per-artist breakdowns.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[90px] w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border/50 rounded-xl">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" strokeWidth={1.9} />
          <h2 className="text-xl font-serif mb-2">Could not load ledger</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {(error as any)?.data?.error || (error as Error)?.message || "There was a problem loading the payment overview. Please try again."}
          </p>
        </div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((item) => (
            <PaymentOverviewItem key={item.appointmentId} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border/50 rounded-xl border-dashed">
          <Receipt className="h-12 w-12 text-primary/40 mb-4" strokeWidth={1.9} />
          <h2 className="text-xl font-serif mb-2 text-foreground">No Ledger Data</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            There are no completed bookings with ledger details yet.
          </p>
        </div>
      )}
    </div>
  );
}
