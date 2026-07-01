import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-serif font-bold sm:inline-block text-xl">
                GlamNet
              </span>
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/stylists" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/stylists') ? 'text-primary' : 'text-muted-foreground'}`}>
                Discover Stylists
              </Link>
              <Link href="/casting" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith('/casting') ? 'text-primary' : 'text-muted-foreground'}`}>
                Casting Calls
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  Dashboard
                </Link>
                <Link href="/messages" className="text-sm font-medium text-muted-foreground hover:text-primary">
                  Messages
                </Link>
                <Button variant="ghost" size="sm" onClick={() => logout()}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <footer className="border-t border-border bg-card py-6 md:py-0 mt-auto">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for SA's finest beauty professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}
