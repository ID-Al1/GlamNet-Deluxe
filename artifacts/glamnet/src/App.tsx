import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { Toaster as SonnerToaster } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { BonisaSplash } from "@/components/bonisa-splash";
import { Loader2 } from "lucide-react";
import { OwnerLayout } from "@/components/layout/owner-layout";
import { ErrorBoundary } from "@/components/error-boundary";

// Lazy-load all page components for automatic code splitting
const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/auth/login"));
const Signup = lazy(() => import("@/pages/auth/signup"));
const DashboardRouter = lazy(() => import("@/pages/dashboard"));
const StylistDashboard = lazy(() => import("@/pages/dashboards/stylist-dashboard"));
const StylistsList = lazy(() => import("@/pages/stylists/index"));
const StylistProfile = lazy(() => import("@/pages/stylists/[id]"));
const BookStylist = lazy(() => import("@/pages/book/[stylistId]"));
const MyAppointment = lazy(() => import("@/pages/appointments/[id]"));
const BookingSuccess = lazy(() => import("@/pages/booking/success"));
const Messages = lazy(() => import("@/pages/messages/index"));
const CastingCalls = lazy(() => import("@/pages/casting/index"));
const Profile = lazy(() => import("@/pages/profile/index"));
const ProfileSetup = lazy(() => import("@/pages/profile/setup"));
const LeaveReview = lazy(() => import("@/pages/reviews/[appointmentId]"));
const PaymentHistory = lazy(() => import("@/pages/payments/index"));
const ComplaintsList = lazy(() => import("@/pages/complaints/index"));
const NewComplaint = lazy(() => import("@/pages/complaints/new"));
const ComplaintDetail = lazy(() => import("@/pages/complaints/[id]"));
const NotFound = lazy(() => import("@/pages/not-found"));
const OwnerPortal = lazy(() => import("@/pages/owner/index"));
const OwnerRegistry = lazy(() => import("@/pages/owner/registry/index"));
const OwnerRegistryProfile = lazy(() => import("@/pages/owner/registry/[userId]"));
const OwnerArtists = lazy(() => import("@/pages/owner/artists"));
const OwnerArtistDetail = lazy(() => import("@/pages/owner/artists/[profileId]"));
const OwnerVerifications = lazy(() => import("@/pages/owner/verifications"));
const OwnerPayouts = lazy(() => import("@/pages/owner/payouts/index"));
const OwnerPaymentsOverview = lazy(() => import("@/pages/owner/payments-overview/index"));
const OwnerComplaints = lazy(() => import("@/pages/owner/complaints/index"));
const OwnerComplaintDetail = lazy(() => import("@/pages/owner/complaints/[id]"));
const OwnerModels = lazy(() => import("@/pages/owner/models"));
const OwnerOversight = lazy(() => import("@/pages/owner/oversight"));
const TalentDirectory = lazy(() => import("@/pages/talent/index"));
const TalentProfilePage = lazy(() => import("@/pages/talent/[id]"));
const CompCard = lazy(() => import("@/pages/talent/card"));
const Opportunities = lazy(() => import("@/pages/opportunities/index"));
const OpportunityDetail = lazy(() => import("@/pages/opportunities/[id]"));
const About = lazy(() => import("@/pages/about"));
const BrandOpportunities = lazy(() => import("@/pages/brand/opportunities"));
const WorkspaceOverview = lazy(() => import("@/pages/workspace/index"));
const WorkspacePortfolio = lazy(() => import("@/pages/workspace/portfolio"));
const WorkspaceBrand = lazy(() => import("@/pages/workspace/brand"));
const WorkspaceOpportunities = lazy(() => import("@/pages/workspace/opportunities"));
const WorkspaceApplications = lazy(() => import("@/pages/workspace/applications"));
const WorkspaceCampaigns = lazy(() => import("@/pages/workspace/campaigns"));
const WorkspaceEarnings = lazy(() => import("@/pages/workspace/earnings"));
const WorkspaceContracts = lazy(() => import("@/pages/workspace/contracts"));
const WorkspaceSettings = lazy(() => import("@/pages/workspace/settings"));

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

/** Sends anyone who is not signed in as `role` away before the page (and its data requests) loads. Screen-level only: the API enforces the same rule. */
function RequireRole({ role, children }: { role: "model" | "brand"; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (user.role !== role) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

/** Most screens call `toast` from sonner, so its display has to be mounted or those messages are never seen. */
function AppSonner() {
  const { theme } = useTheme();
  return <SonnerToaster theme={theme} position="top-center" closeButton />;
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
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/profile/setup">
            <AppLayout>
              <ProfileSetup />
            </AppLayout>
          </Route>
          <Route>
            <AppLayout>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Switch>
                <Route path="/" component={Home} />
                <Route path="/login" component={Login} />
                <Route path="/signup" component={Signup} />
                <Route path="/profile" component={Profile} />
                <Route path="/dashboard/artist">
                  <RequireOwner>
                    <StylistDashboard />
                  </RequireOwner>
                </Route>
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
                <Route path="/complaints" component={ComplaintsList} />
                <Route path="/complaints/new" component={NewComplaint} />
                <Route path="/complaints/:id" component={ComplaintDetail} />
                <Route path="/owner">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerPortal />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/payouts">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerPayouts />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/payments-overview">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerPaymentsOverview />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/registry">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerRegistry />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/artists">
                  <RequireOwner><OwnerLayout><Suspense fallback={<PageLoader />}><OwnerArtists /></Suspense></OwnerLayout></RequireOwner>
                </Route>
                <Route path="/owner/artists/:profileId">
                  <RequireOwner><OwnerLayout><Suspense fallback={<PageLoader />}><OwnerArtistDetail /></Suspense></OwnerLayout></RequireOwner>
                </Route>
                <Route path="/owner/registry/:userId">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerRegistryProfile />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/verifications">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerVerifications />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/complaints">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerComplaints />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/complaints/:id">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerComplaintDetail />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/talent" component={TalentDirectory} />
                <Route path="/talent/:id/card" component={CompCard} />
                <Route path="/talent/:id" component={TalentProfilePage} />
                <Route path="/opportunities" component={Opportunities} />
                <Route path="/opportunities/:id" component={OpportunityDetail} />
                <Route path="/about" component={About} />
                <Route path="/brand/opportunities"><RequireRole role="brand"><BrandOpportunities /></RequireRole></Route>
                <Route path="/workspace"><RequireRole role="model"><WorkspaceOverview /></RequireRole></Route>
                <Route path="/workspace/portfolio"><RequireRole role="model"><WorkspacePortfolio /></RequireRole></Route>
                <Route path="/workspace/brand"><RequireRole role="model"><WorkspaceBrand /></RequireRole></Route>
                <Route path="/workspace/opportunities"><RequireRole role="model"><WorkspaceOpportunities /></RequireRole></Route>
                <Route path="/workspace/applications"><RequireRole role="model"><WorkspaceApplications /></RequireRole></Route>
                <Route path="/workspace/campaigns"><RequireRole role="model"><WorkspaceCampaigns /></RequireRole></Route>
                <Route path="/workspace/earnings"><RequireRole role="model"><WorkspaceEarnings /></RequireRole></Route>
                <Route path="/workspace/contracts"><RequireRole role="model"><WorkspaceContracts /></RequireRole></Route>
                <Route path="/workspace/settings"><RequireRole role="model"><WorkspaceSettings /></RequireRole></Route>
                <Route path="/owner/models">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerModels />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                <Route path="/owner/oversight">
                  <RequireOwner>
                    <OwnerLayout>
                      <Suspense fallback={<PageLoader />}>
                        <OwnerOversight />
                      </Suspense>
                    </OwnerLayout>
                  </RequireOwner>
                </Route>
                    <Route component={NotFound} />
                  </Switch>
                </Suspense>
              </ErrorBoundary>
            </AppLayout>
          </Route>
        </Switch>
      </Suspense>
    </ErrorBoundary>
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
          <AppSonner />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
