import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X, Scissors, Briefcase, MessageCircle, LayoutDashboard, Users, Star, LogOut, LogIn, UserPlus } from "lucide-react";

const NAV_PUBLIC = [
  { href: "/stylists", label: "Discover Talent", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const NAV_AUTH = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/stylists", label: "Discover Talent", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = user ? NAV_AUTH : NAV_PUBLIC;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <Scissors className="h-5 w-5 text-primary rotate-45" />
            <span className="font-serif font-bold text-xl tracking-tight">GlamNet</span>
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background border-l border-border/60 p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border/60">
                  <Scissors className="h-5 w-5 text-primary rotate-45" />
                  <span className="font-serif font-bold text-xl">GlamNet</span>
                </div>

                {user && (
                  <div className="px-6 py-4 border-b border-border/60 bg-card/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed in as</p>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-primary capitalize">{user.role === "stylist" ? "Artist / Barber" : user.role}</p>
                  </div>
                )}

                <nav className="flex-1 px-4 py-4 space-y-1">
                  {navItems.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        location === href || location.startsWith(href + "/")
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-card hover:text-foreground"
                      }`}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </div>
                    </Link>
                  ))}
                </nav>

                <div className="px-4 py-4 border-t border-border/60 space-y-2">
                  {user ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                      onClick={() => { logout(); setOpen(false); }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full justify-start gap-3">
                          <LogIn className="h-4 w-4" />
                          Log in
                        </Button>
                      </Link>
                      <Link href="/signup" onClick={() => setOpen(false)}>
                        <Button className="w-full justify-start gap-3">
                          <UserPlus className="h-4 w-4" />
                          Create account
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/60 bg-card/50 py-8 mt-auto">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary rotate-45" />
            <span className="font-serif font-bold text-sm">GlamNet</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            The definitive platform for South Africa's beauty industry.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/stylists" className="hover:text-primary transition-colors">Find Talent</Link>
            <Link href="/casting" className="hover:text-primary transition-colors">Casting</Link>
            <Link href="/signup" className="hover:text-primary transition-colors">Join</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
