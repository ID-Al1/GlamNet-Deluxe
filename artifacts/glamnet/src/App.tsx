import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout/app-layout";

import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import DashboardRouter from "@/pages/dashboard";
import StylistsList from "@/pages/stylists/index";
import StylistProfile from "@/pages/stylists/[id]";
import BookStylist from "@/pages/book/[stylistId]";
import BookingSuccess from "@/pages/booking/success";
import Messages from "@/pages/messages/index";
import CastingCalls from "@/pages/casting/index";
import ProfileSetup from "@/pages/profile/setup";
import LeaveReview from "@/pages/reviews/[appointmentId]";
import NotFound from "@/pages/not-found";

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

function Router() {
  return (
    <Switch>
      <Route path="/profile/setup" component={ProfileSetup} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/dashboard" component={DashboardRouter} />
            <Route path="/stylists" component={StylistsList} />
            <Route path="/stylists/:id" component={StylistProfile} />
            <Route path="/book/:stylistId" component={BookStylist} />
            <Route path="/booking/success" component={BookingSuccess} />
            <Route path="/messages" component={Messages} />
            <Route path="/casting" component={CastingCalls} />
            <Route path="/reviews/:appointmentId" component={LeaveReview} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
