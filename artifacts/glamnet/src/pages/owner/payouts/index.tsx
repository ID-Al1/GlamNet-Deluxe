import { useState } from "react";
import { 
  useGetOwnerPayouts, 
  useMarkOwnerPayoutPaid, 
  getGetOwnerPayoutsQueryKey,
  getGetOwnerPaymentsOverviewQueryKey,
  GetOwnerPayoutsFilter
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Banknote, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { OwnerPayoutGroup } from "@workspace/api-client-react";

function PayoutGroup({ group }: { group: OwnerPayoutGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reference, setReference] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const markPaid = useMarkOwnerPayoutPaid({
    mutation: {
      onSuccess: () => {
        toast({ title: "EFT Recorded", description: `Payout for ${group.artistName} marked as paid.` });
        setIsDialogOpen(false);
        setReference("");
        queryClient.invalidateQueries({ queryKey: getGetOwnerPayoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOwnerPaymentsOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/owner/command-centre"] });
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to record EFT", 
          description: err?.data?.error || err?.message || "An unexpected error occurred.",
          variant: "destructive" 
        });
      }
    }
  });

  const handleRecordEft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    
    markPaid.mutate({
      artistProfileId: group.artistProfileId,
      data: {
        reference: reference.trim(),
        lineIds: group.lines.map((l) => l.id),
        expectedTotal: group.totalAmount
      }
    });
  };

  return (
    <Card className="bg-card border-border/60 shadow-sm overflow-hidden mb-4">
      <div 
        className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Banknote className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{group.artistName}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="font-medium text-foreground">{group.lineCount}</span> {group.lineCount === 1 ? 'booking' : 'bookings'} pending
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 justify-between md:justify-end">
          <div className="text-right">
            <p className="text-2xl font-serif">R {group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">Total Due</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={(e) => e.stopPropagation()} 
                  className="font-medium"
                >
                  Record EFT
                </Button>
              </DialogTrigger>
              <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Confirm Payout</DialogTitle>
                  <DialogDescription>
                    You are recording a manual EFT payment for <strong>{group.artistName}</strong>.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="bg-muted/30 p-4 rounded-lg my-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-semibold text-lg">R {group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Lines to Settle</span>
                    <span className="font-medium">{group.lineCount}</span>
                  </div>
                </div>

                <form onSubmit={handleRecordEft} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`reference-${group.artistProfileId}`}>Bank Reference / Proof of Payment ID</Label>
                    <Input 
                      id={`reference-${group.artistProfileId}`}
                      placeholder="e.g. EFT-INV-001" 
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      required
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={markPaid.isPending}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!reference.trim() || markPaid.isPending}>
                      {markPaid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm Payment
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              {isExpanded ? <ChevronUp className="h-5 w-5" strokeWidth={1.9} /> : <ChevronDown className="h-5 w-5" strokeWidth={1.9} />}
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/40 bg-muted/10 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Client & Service</th>
                  <th className="px-6 py-3 font-medium">Ref ID</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {group.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">
                      {format(new Date(line.date), "dd MMM yyyy")}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-foreground">{line.clientName}</div>
                      <div className="text-xs text-muted-foreground">{line.serviceName}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-muted-foreground text-xs font-mono">
                      {line.appointmentId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right font-medium">
                      R {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function OwnerPayouts() {
  const [filter, setFilter] = useState<GetOwnerPayoutsFilter>("oldest");

  const { data: groups, isLoading, error } = useGetOwnerPayouts({ filter });

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl mb-2">Pending Payouts</h1>
          <p className="text-sm text-muted-foreground">
            Review and settle outstanding artist balances.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort by</Label>
          <Select value={filter} onValueChange={(val: GetOwnerPayoutsFilter) => setFilter(val)}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">Oldest Due First</SelectItem>
              <SelectItem value="highest">Highest Amount</SelectItem>
              <SelectItem value="this-week">Due This Week</SelectItem>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[100px] w-full rounded-xl" />
          <Skeleton className="h-[100px] w-full rounded-xl" />
          <Skeleton className="h-[100px] w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border/50 rounded-xl">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" strokeWidth={1.9} />
          <h2 className="text-xl font-serif mb-2">Could not load payouts</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {(error as any)?.data?.error || (error as Error)?.message || "There was a problem loading the payout data. Please try again."}
          </p>
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map((group) => (
            <PayoutGroup key={group.artistProfileId} group={group} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border/50 rounded-xl border-dashed">
          <CheckCircle2 className="h-12 w-12 text-primary/40 mb-4" strokeWidth={1.9} />
          <h2 className="text-xl font-serif mb-2 text-foreground">All Caught Up</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            There are no pending payouts at this time.
          </p>
        </div>
      )}
    </div>
  );
}
