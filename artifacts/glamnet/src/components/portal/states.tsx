import type { ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.9} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message = "We could not load this.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3" role="alert">
      <AlertCircle className="h-6 w-6 mx-auto text-destructive" strokeWidth={1.9} aria-hidden="true" />
      <p className="text-sm text-foreground">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyBlock({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center space-y-3">
      {icon && <div className="mx-auto h-10 w-10 flex items-center justify-center text-gold" aria-hidden="true">{icon}</div>}
      <h3 className="text-lg font-serif font-bold">{title}</h3>
      {children && <div className="text-sm text-muted-foreground max-w-md mx-auto">{children}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

/** Notice shown wherever a feature has no backend yet, so nothing looks live that is not. */
export function NotLiveNotice({ title = "Not live yet", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/50 bg-gold/10 p-5 space-y-1.5" role="note">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{title}</p>
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="space-y-3">
      {eyebrow && (
        <p className="flex items-center gap-3 text-primary text-xs font-semibold uppercase tracking-widest">
          <span className="h-px w-8 bg-gold" aria-hidden="true" />{eyebrow}
        </p>
      )}
      <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">{title}</h1>
      {children && <div className="text-muted-foreground max-w-2xl">{children}</div>}
    </div>
  );
}
