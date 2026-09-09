import { useGetOwnerCommandCentre } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CheckCircle2,
  Clock,
  Wallet,
  Percent,
  AlertOctagon,
} from "lucide-react";

export default function OwnerCommandCentre() {
  const { data: metrics, isLoading, error } = useGetOwnerCommandCentre();

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[40vh] text-center">
        <div>
          <AlertOctagon className="h-10 w-10 mx-auto mb-4 text-destructive" strokeWidth={1.9} />
          <h2 className="text-xl font-serif mb-2">Could not load metrics</h2>
          <p className="text-muted-foreground text-sm">Please try refreshing the page or check your connection.</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Artists",
      value: metrics?.totalArtists,
      icon: Users,
      testId: "metric-total-artists"
    },
    {
      title: "Verified Artists",
      value: metrics?.verifiedArtists,
      icon: CheckCircle2,
      testId: "metric-verified-artists"
    },
    {
      title: "Pending Verifications",
      value: metrics?.pendingVerifications,
      icon: Clock,
      testId: "metric-pending-verifications"
    },
    {
      title: "Payments to Release",
      value: metrics?.paymentsToRelease,
      icon: Wallet,
      prefix: "R ",
      testId: "metric-payments-release"
    },
    {
      title: "Bonisa Commission",
      value: metrics?.bonisaCommission,
      icon: Percent,
      prefix: "R ",
      testId: "metric-bonisa-commission"
    },
    {
      title: "Open Disputes",
      value: metrics?.openDisputes,
      icon: AlertOctagon,
      testId: "metric-open-disputes",
      danger: (metrics?.openDisputes ?? 0) > 0
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl mb-2">Command Centre</h1>
        <p className="text-sm text-muted-foreground">
          Platform health, pending actions, and financial metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon
                className={`h-4 w-4 ${stat.danger ? "text-destructive" : "text-muted-foreground"}`}
                strokeWidth={1.9}
              />
            </CardHeader>
            <CardContent>
              {isLoading || stat.value === undefined ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div
                  className={`text-2xl font-semibold ${stat.danger ? 'text-destructive' : ''}`}
                  data-testid={stat.testId}
                >
                  {stat.prefix}{stat.value.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto flex flex-col md:flex-row items-center justify-center gap-2">
          <Wallet className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          Note: Financial metrics reflect calculated platform balances. "Payments to release" means funds are ready for disbursement, but does not confirm a completed bank payout.
        </p>
      </div>
    </div>
  );
}
