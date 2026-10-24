import { Link, Redirect, useLocation } from "wouter";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Images, Sparkles, Briefcase, Send, Clapperboard, Wallet, FileSignature, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const TABS = [
  { href: "/workspace", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/workspace/portfolio", label: "My Portfolio", icon: Images },
  { href: "/workspace/brand", label: "My Brand", icon: Sparkles },
  { href: "/workspace/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/workspace/applications", label: "Applications", icon: Send },
  { href: "/workspace/campaigns", label: "Campaigns", icon: Clapperboard },
  { href: "/workspace/earnings", label: "My Earnings", icon: Wallet },
  { href: "/workspace/contracts", label: "Contracts & Permissions", icon: FileSignature },
  { href: "/workspace/settings", label: "Settings", icon: Settings },
];

/**
 * Model workspace shell. The screen check here is for tidiness only: every API call
 * behind these pages is separately limited to models on the server.
 */
export function ModelLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "model") return <Redirect to="/dashboard" />;

  return (
    <div className="portal-theme flex-1 flex flex-col min-h-0">
      <nav aria-label="Model workspace" className="border-b border-border bg-card sticky top-[48px] md:top-16 z-40">
        <div className="container max-w-6xl px-4 flex gap-5 overflow-x-auto hide-scrollbar">
          {TABS.map((t) => {
            const active = t.exact ? location === t.href : location === t.href || location.startsWith(`${t.href}/`);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 py-3.5 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${active ? "border-gold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <t.icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />{t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="container max-w-6xl px-4 py-8 sm:py-10 space-y-8">{children}</div>
    </div>
  );
}
