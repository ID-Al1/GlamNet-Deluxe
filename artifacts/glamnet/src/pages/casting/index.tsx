import { useState } from "react";
import { useListCastingCalls } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

const SPECIALTIES = ["All", "Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

async function applyToCasting(castingId: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/casting/${castingId}/apply`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to apply");
  }
  return res.json();
}

export default function CastingCalls() {
  const [specialty, setSpecialty] = useState("");
  const { data: castings, isLoading, error, refetch } = useListCastingCalls(
    specialty ? { specialty } : undefined
  );
  const qc = useQueryClient();

  const apply = useMutation({
    mutationFn: applyToCasting,
    onSuccess: () => {
      toast.success("Application sent!");
      qc.invalidateQueries({ queryKey: ["casting"] });
      qc.invalidateQueries({ queryKey: ["castingCalls"] });
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "Failed to apply"),
  });

  return (
    <div className="container py-8 sm:py-12 max-w-6xl space-y-8 px-4">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-accent text-xs font-semibold uppercase tracking-widest">For Artists</p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">Casting Calls</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Apply to exclusive campaigns from top beauty brands and agencies.
        </p>
      </div>

      {/* Specialty filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SPECIALTIES.map(s => {
          const isActive = specialty === (s === "All" ? "" : s);
          return (
            <button
              key={s}
              onClick={() => setSpecialty(s === "All" ? "" : s)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="text-center py-24 border rounded-2xl border-dashed border-destructive/40 space-y-4">
          <p className="font-serif text-xl font-bold text-destructive">Couldn't load casting calls</p>
          <p className="text-muted-foreground text-sm">Something went wrong. Please try again.</p>
          <Button variant="outline" size="sm" className="rounded-full px-5" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-5">
          {[1,2,3].map(i => (
            <Card key={i} className="h-44 animate-pulse bg-muted border-border/50" />
          ))}
        </div>
      ) : castings?.length === 0 ? (
        <div className="text-center py-24 border rounded-2xl border-dashed border-border/50 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1.5">
            <p className="font-serif text-xl font-bold">No open castings yet</p>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Brands haven't posted any casting calls yet. Check back soon — this is where paid campaigns from top SA brands go live.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {castings?.map(call => (
            <Card key={call.id} className="overflow-hidden bg-card border-border/50 hover:border-border transition-all hover:shadow-md group">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  {/* Main content */}
                  <div className="flex-1 p-6 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <h3 className="font-serif text-2xl font-bold leading-tight">{call.title}</h3>
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs font-semibold shrink-0 mt-1"
                        style={{ color: 'hsl(var(--baby-blue))', borderColor: 'hsl(var(--baby-blue) / 0.35)', background: 'hsl(var(--baby-blue) / 0.08)' }}
                      >
                        {call.specialty}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">By {call.brandName}</p>
                    <p className="text-muted-foreground leading-relaxed line-clamp-3">
                      {call.brief}
                    </p>
                  </div>

                  {/* Sidebar */}
                  <div className="md:w-52 p-6 md:border-l border-t md:border-t-0 border-border/40 flex flex-col justify-between gap-5 shrink-0 bg-muted/30">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          <DollarSign className="h-3 w-3" />Budget
                        </div>
                        <p className="font-serif font-bold text-lg" style={{ color: 'hsl(var(--orange))' }}>{call.budget}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          <Clock className="h-3 w-3" />Deadline
                        </div>
                        <p className="font-medium text-sm">{new Date(call.deadline).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                    </div>

                    <Button
                      className="w-full rounded-full"
                      disabled={call.hasApplied || apply.isPending}
                      onClick={() => apply.mutate(call.id)}
                      variant={call.hasApplied ? "outline" : "default"}
                    >
                      {call.hasApplied ? "Applied ✓" : apply.isPending ? "Applying…" : "Apply Now"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
