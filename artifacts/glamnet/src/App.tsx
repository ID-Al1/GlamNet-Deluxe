import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout/app-layout";
import { BonisaSplash } from "@/components/bonisa-splash";
import { Loader2 } from "lucide-react";

// Lazy-load all page components for automatic code splitting
const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/auth/login"));
const Signup = lazy(() => import("@/pages/auth/signup"));
const DashboardRouter = lazy(() => import("@/pages/dashboard"));
const StylistsList = lazy(() => import("@/pages/stylists/index"));
const StylistProfile = lazy(() => import("@/pages/stylists/[id]"));
const BookStylist = lazy(() => import("@/pages/book/[stylistId]"));
const MyAppointment = lazy(() => import("@/pages/appointments/[id]"));
const BookingSuccess = lazy(() => import("@/pages/booking/success"));
const Messages = lazy(() => import("@/pages/messages/index"));
const CastingCalls = lazy(() => import("@/pages/casting/index"));
const ProfileSetup = lazy(() => import("@/pages/profile/setup"));
const LeaveReview = lazy(() => import("@/pages/reviews/[appointmentId]"));
const PaymentHistory = lazy(() => import("@/pages/payments/index"));
const NotFound = lazy(() => import("@/pages/not-found"));
const OwnerPortal = lazy(() => import("@/pages/owner"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Redirects anyone who is not the owner to /dashboard before the page renders. */
function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!user?.isOwner) navigate("/dashboard");
  }, [user, navigate]);
  if (!user?.isOwner) return null;
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]" aria-live="polite" aria-label="Loading page">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/profile/setup" component={ProfileSetup} />
        <Route>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/login" component={Login} />
                <Route path="/signup" component={Signup} />
                <Route path="/dashboard" component={DashboardRouter} />
                <Route path="/stylists" component={StylistsList} />
                <Route path="/stylists/:id" component={StylistProfile} />
                <Route path="/book/:stylistId" component={BookStylist} />
                <Route path="/appointments/:id" component={MyAppointment} />
                <Route path="/booking/success" component={BookingSuccess} />
                <Route path="/messages" component={Messages} />
                <Route path="/casting" component={CastingCalls} />
                <Route path="/reviews/:appointmentId" component={LeaveReview} />
                <Route path="/payments" component={PaymentHistory} />
                <Route path="/owner">
                  <RequireOwner>
                    <Suspense fallback={<PageLoader />}>
                      <OwnerPortal />
                    </Suspense>
                  </RequireOwner>
                </Route>
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </AppLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <BonisaSplash />
              <Router />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
