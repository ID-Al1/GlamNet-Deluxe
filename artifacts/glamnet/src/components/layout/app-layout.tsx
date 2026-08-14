import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { BonisaLogo } from "@/components/bonisa-logo";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X, MessageCircle, LayoutDashboard, Users, Star, LogOut, LogIn, UserPlus, Sun, Moon, Home, Search, Calendar, User } from "lucide-react";

const NAV_PUBLIC = [
  { href: "/stylists", label: "Find Artists", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const NAV_AUTH_CLIENT = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/stylists", label: "Find Artists", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const NAV_AUTH_STYLIST = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const NAV_AUTH_BRAND = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/stylists", label: "Find Artists", icon: Users },
  { href: "/casting", label: "Casting Calls", icon: Star },
];

const BOTTOM_TAB_NAV = [
  { href: "/dashboard", label: "Home", icon: Home, matchPattern: /^\/(dashboard)?$/ },
  { href: "/stylists", label: "Artists", icon: Search, matchPattern: /^\/stylists/ },
  { href: "/payments", label: "Bookings", icon: Calendar, matchPattern: /^\/(payments|appointments)/ },
  { href: "/messages", label: "Messages", icon: MessageCircle, matchPattern: /^\/messages/ },
  { href: "/profile/setup", label: "Profile", icon: User, matchPattern: /^\/profile/ },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = !user
    ? NAV_PUBLIC
    : user.role === "stylist"
    ? NAV_AUTH_STYLIST
    : user.role === "brand"
    ? NAV_AUTH_BRAND
    : NAV_AUTH_CLIENT;
    
  // Don't use a transparent header on mobile when logged in because the layout is app-like
  const isHome = location === "/" && (!isMobile || !user);
  
  // Define when to show bottom tab bar
  const showBottomTabs = user && isMobile;

  return (
    <div className={`min-h-[100dvh] flex flex-col bg-background text-foreground ${showBottomTabs ? "pb-[72px]" : ""}`}>
      {/* Skip to main content — visible on keyboard focus only */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-lg focus:shadow-lg focus:font-medium focus:border focus:border-border focus:outline-none"
      >
        Skip to main content
      </a>

      {/* ── Authenticated mobile top bar ── */}
      {showBottomTabs && (
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30 h-12 flex items-center justify-between px-4 shrink-0">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <BonisaLogo size={22} />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" aria-label="Messages">
                <MessageCircle className="h-[18px] w-[18px]" />
              </Button>
            </Link>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
                  {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
                </Button>
              </SheetTrigger>
              <SheetContent id="mobile-nav-auth" side="right" className="w-80 bg-background border-l border-border/60 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center px-6 py-5 border-b border-border/60">
                    <BonisaLogo size={26} />
                  </div>
                  <div className="px-6 py-4 border-b border-border/60 bg-muted/40">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed in as</p>
                    <p className="font-semibold text-sm">{user?.name}</p>
                    <p className="text-xs text-primary capitalize">{user?.role === "stylist" ? "Artist / Barber" : user?.role}</p>
                  </div>
                  <nav aria-label="Mobile navigation" className="flex-1 px-4 py-4 space-y-1">
                    {navItems.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={location === href || location.startsWith(href + "/") ? "page" : undefined}>
                        <div className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                          location === href || location.startsWith(href + "/")
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {label}
                        </div>
                      </Link>
                    ))}
                  </nav>
                  <div className="px-4 pb-2">
                    <button
                      onClick={toggle}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </button>
                  </div>
                  <div className="px-4 py-4 border-t border-border/60">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                      onClick={() => { logout(); setOpen(false); }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
      )}

      {/* ── Desktop / unauthenticated header ── */}
      {!showBottomTabs && (
        <header className={`sticky top-0 z-50 w-full transition-colors duration-200 ${
          isHome ? "bg-transparent border-none" : "bg-white border-b border-border/60"
        }`}>
          <div className="container flex h-16 items-center justify-between max-w-6xl">
            <Link href="/" className="flex items-center shrink-0" onClick={() => setOpen(false)}>
              <BonisaLogo size={30} light={isHome} />
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label }) => (
                <Link key={href} href={href} aria-current={location === href || location.startsWith(href + "/") ? "page" : undefined}>
                  <span className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    isHome
                      ? "text-white/80 hover:text-white"
                      : location === href || location.startsWith(href + "/")
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
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="Toggle theme"
                className={`hidden md:flex ${isHome ? "text-white/70 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground"}`}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <span className={`text-sm ${isHome ? "text-white/80" : "text-muted-foreground"}`}>{user.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className={isHome ? "text-white/70 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-destructive"}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className={`text-sm font-medium ${isHome ? "text-white/80 hover:text-white hover:bg-white/10" : ""}`}>Log in</Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className={`text-sm font-medium rounded-full px-5 ${isHome ? "bg-white text-foreground hover:bg-white/90" : ""}`}>Sign up</Button>
                  </Link>
                </div>
              )}

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav">
                    {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                  </Button>
                </SheetTrigger>
                <SheetContent id="mobile-nav" side="right" className="w-80 bg-background border-l border-border/60 p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center px-6 py-5 border-b border-border/60">
                      <BonisaLogo size={26} />
                    </div>

                    {user && (
                      <div className="px-6 py-4 border-b border-border/60 bg-muted/40">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed in as</p>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-primary capitalize">{user.role === "stylist" ? "Artist / Barber" : user.role}</p>
                      </div>
                    )}

                    <nav aria-label="Mobile navigation" className="flex-1 px-4 py-4 space-y-1">
                      {navItems.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={location === href || location.startsWith(href + "/") ? "page" : undefined}>
                          <div className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                            location === href || location.startsWith(href + "/")
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}>
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
      )}

      <main id="main-content" className="flex-1 flex flex-col relative">
        {children}
      </main>

      {!showBottomTabs && (
        <footer className="border-t border-border/60 bg-background py-10 mt-auto">
          <div className="container max-w-6xl px-4">
            <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
              <div className="space-y-3">
                <BonisaLogo size={26} />
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
              © {new Date().getFullYear()} Bonisa. All rights reserved.
            </div>
          </div>
        </footer>
      )}

      {/* Bottom Tab Navigation for Mobile Authenticated Users */}
      {showBottomTabs && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/60 pb-safe pt-2 px-6 flex justify-between items-center shadow-[0_-4px_24px_rgba(0,0,0,0.04)] h-[72px]">
          {BOTTOM_TAB_NAV.map(({ href, label, icon: Icon, matchPattern }) => {
            const isActive = matchPattern.test(location);
            return (
              <Link key={href} href={href}>
                <div className="flex flex-col items-center justify-center gap-1 min-w-[56px] h-full">
                  <div className={`transition-all duration-300 flex flex-col items-center justify-center ${isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground scale-100"}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                    <span className={`text-[10px] mt-1 tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}>
                      {label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
