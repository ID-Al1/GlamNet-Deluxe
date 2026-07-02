import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X, MessageCircle, LayoutDashboard, Users, Star, LogOut, LogIn, UserPlus, Sun, Moon } from "lucide-react";

const NAV_PUBLIC = [
  { href: "/stylists", label: "Find Artists", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const NAV_AUTH = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/stylists", label: "Find Artists", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = user ? NAV_AUTH : NAV_PUBLIC;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Always-white header — clean and consistent */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-border/60">
        <div className="container flex h-16 items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center shrink-0" onClick={() => setOpen(false)}>
            <img
              src="/logo-transparent.png"
              alt="GlamNet"
              className="object-contain"
              style={{ width: 110, height: "auto" }}
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  location === href || location.startsWith(href + "/")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                  {label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle — desktop */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
              className="hidden md:flex text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Desktop auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{user.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-sm font-medium">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="text-sm font-medium rounded-full px-5">Sign up</Button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-white border-l border-border/60 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center px-6 py-5 border-b border-border/60">
                    <img src="/logo-transparent.png" alt="GlamNet" className="h-8 w-auto object-contain" />
                  </div>

                  {user && (
                    <div className="px-6 py-4 border-b border-border/60 bg-muted/40">
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
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}>
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </div>
                      </Link>
                    ))}
                  </nav>

                  <div className="px-4 pb-2">
                    <button
                      onClick={toggle}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </button>
                  </div>

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
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/60 bg-white py-10 mt-auto">
        <div className="container max-w-6xl px-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div className="space-y-3">
              <img src="/logo-transparent.png" alt="GlamNet" className="h-8 w-auto object-contain" />
              <p className="text-sm text-muted-foreground max-w-xs">
                The definitive platform for South Africa's beauty industry.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-3">
                <p className="font-semibold text-foreground">Discover</p>
                <div className="space-y-2 text-muted-foreground">
                  <Link href="/stylists" className="block hover:text-primary transition-colors">Find Artists</Link>
                  <Link href="/casting" className="block hover:text-primary transition-colors">Casting Calls</Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-foreground">Join</p>
                <div className="space-y-2 text-muted-foreground">
                  <Link href="/signup" className="block hover:text-primary transition-colors">For Artists</Link>
                  <Link href="/signup" className="block hover:text-primary transition-colors">For Brands</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} GlamNet. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
