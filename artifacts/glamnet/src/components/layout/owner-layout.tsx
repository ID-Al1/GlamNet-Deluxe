import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ShieldCheck, Banknote, ListTree, Scissors } from "lucide-react";
import type { ReactNode } from "react";

export function OwnerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const tabs = [
    { href: "/owner", label: "Command Centre", icon: LayoutDashboard, exact: true },
    { href: "/owner/payouts", label: "Payouts", icon: Banknote, exact: false },
    { href: "/owner/payments-overview", label: "Ledger", icon: ListTree, exact: false },
    { href: "/owner/registry", label: "Registry", icon: Users, exact: false },
    { href: "/owner/artists", label: "Artists", icon: Scissors, exact: false },
    { href: "/owner/verifications", label: "Verifications", icon: ShieldCheck, exact: false },
    { href: "/owner/complaints", label: "Cases", icon: ShieldCheck, exact: false },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      <div className="border-b border-border/60 bg-muted/10 sticky top-[48px] md:top-16 z-40">
        <div className="container max-w-6xl px-4 flex gap-6 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.exact 
              ? location === tab.href 
              : location === tab.href || location.startsWith(`${tab.href}/`);
              
            return (
              <Link 
                key={tab.href} 
                href={tab.href} 
                className={`flex items-center gap-2 py-3 md:py-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                data-testid={`link-owner-tab-${tab.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <tab.icon className="h-4 w-4" strokeWidth={1.9} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col container max-w-6xl w-full mx-auto px-4 py-8 min-h-0">
        {children}
      </div>
    </div>
  );
}
