import { Link } from "wouter";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useListMyApplications, useListMyEnquiries, useListMySavedOpportunities } from "@workspace/api-client-react";
import { ModelLayout } from "@/components/layout/model-layout";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/portal/states";
import { StatusPill } from "@/components/portal/status-pill";
import { frenchGreeting } from "@/components/bonisa-logo";
import { useModelProfile } from "@/lib/model-profile";
import { VERIFICATION_STATUS } from "@/lib/portal";

export default function WorkspaceOverview() {
  const { profile, isLoading, error, refetch } = useModelProfile();
  const apps = useListMyApplications();
  const saved = useListMySavedOpportunities();
  const enquiries = useListMyEnquiries();

  return (
    <ModelLayout>
      {isLoading ? <LoadingBlock label="Loading your workspace" /> : error || !profile ? <ErrorBlock message="We could not load your workspace." onRetry={() => refetch()} /> : (() => {
        const steps = [
          { done: profile.missingForPublish.length === 0, label: "Complete your profile and four casting digitals", to: "/workspace/portfolio", note: profile.missingForPublish.length ? `Still needed: ${profile.missingForPublish.join(", ")}` : "Done" },
          { done: profile.verificationStatus === "verified", label: "Get verified by Bonisa", to: "/workspace/portfolio", note: VERIFICATION_STATUS[profile.verificationStatus].detail },
          { done: profile.isPublished, label: "Publish your profile when you are ready", to: "/workspace/portfolio", note: profile.isPublished ? "Published" : "Nothing is public until you publish." },
        ];
        const next = steps.find((s) => !s.done);
        const openApps = (apps.data ?? []).filter((a) => a.status === "applied" || a.status === "shortlisted").length;
        return (
          <>
            <header className="space-y-2">
              <p className="text-sm text-muted-foreground">{frenchGreeting()}</p>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight">{profile.professionalName}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={profile.verificationStatus} kind="verification" />
                <span className="text-sm text-muted-foreground">{profile.isListed ? "Listed in the public directory" : "Not in the public directory"}</span>
              </div>
            </header>

            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5" aria-labelledby="setup">
              <h2 id="setup" className="text-2xl">{next ? "Your next step" : "You are set up"}</h2>
              <ol className="space-y-3">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-start gap-3">
                    {s.done ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.9} aria-label="Done" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} aria-label="Not done" />}
                    <div><p className="font-medium">{s.label}</p><p className="text-sm text-muted-foreground">{s.note}</p></div>
                  </li>
                ))}
              </ol>
              {profile.verificationStatus === "rejected" && profile.verificationRejectionReason && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
                  <p className="font-semibold mb-1">Message from Bonisa</p><p>{profile.verificationRejectionReason}</p>
                </div>
              )}
              {next && <Link href={next.to}><Button className="gap-2">Continue<ArrowRight className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" /></Button></Link>}
            </section>

            <section aria-label="At a glance" className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Applications in progress", value: apps.isLoading ? "…" : String(openApps), to: "/workspace/applications" },
                { label: "Saved opportunities", value: saved.isLoading ? "…" : String(saved.data?.length ?? 0), to: "/workspace/opportunities" },
                { label: "Enquiries received", value: enquiries.isLoading ? "…" : String(enquiries.data?.length ?? 0), to: "/workspace/applications" },
              ].map((c) => (
                <Link key={c.label} href={c.to} className="rounded-2xl border border-border bg-card p-5 hover:border-gold transition-colors">
                  <p className="text-4xl font-serif font-bold text-primary">{c.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
                </Link>
              ))}
            </section>
          </>
        );
      })()}
    </ModelLayout>
  );
}
