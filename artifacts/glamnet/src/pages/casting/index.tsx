import { useState } from "react";
import { useListCastingCalls } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";

const SPECIALTIES = ["All", "Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

export default function CastingCalls() {
  const [specialty, setSpecialty] = useState("");
  const { data: castings, isLoading } = useListCastingCalls(
    specialty ? { specialty } : undefined
  );

  return (
    <div className="container py-8 sm:py-12 max-w-6xl space-y-8 px-4">
      <div className="space-y-4">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Casting Calls</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Apply to exclusive campaigns from top beauty brands and agencies.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {SPECIALTIES.map(s => (
          <Button
            key={s}
            variant={specialty === (s === "All" ? "" : s) ? "default" : "outline"}
            onClick={() => setSpecialty(s === "All" ? "" : s)}
            className="rounded-full shrink-0"
          >
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6">
          {[1,2,3].map(i => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
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
        <div className="grid gap-6">
          {castings?.map(call => (
            <Card key={call.id} className="overflow-hidden bg-card/50 backdrop-blur hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-serif text-2xl font-bold">{call.title}</h3>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{call.specialty}</Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">By {call.brandName}</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {call.brief}
                    </p>
                  </div>

                  <div className="md:w-48 space-y-4 flex flex-col justify-between shrink-0">
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Budget</p>
                      <p className="font-serif font-bold text-lg">{call.budget}</p>

                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1 mt-3">Deadline</p>
                      <p className="font-medium text-sm">{new Date(call.deadline).toLocaleDateString()}</p>
                    </div>

                    <Button className="w-full" disabled={call.hasApplied}>
                      {call.hasApplied ? "Applied" : "Apply Now"}
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
