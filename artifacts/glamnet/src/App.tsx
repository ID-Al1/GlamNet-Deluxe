import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";

import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import DashboardRouter from "@/pages/dashboard";
import StylistsList from "@/pages/stylists/index";
import StylistProfile from "@/pages/stylists/[id]";
import BookStylist from "@/pages/book/[stylistId]";
import Messages from "@/pages/messages/index";
import CastingCalls from "@/pages/casting/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/dashboard" component={DashboardRouter} />
        <Route path="/stylists" component={StylistsList} />
        <Route path="/stylists/:id" component={StylistProfile} />
        <Route path="/book/:stylistId" component={BookStylist} />
        <Route path="/messages" component={Messages} />
        <Route path="/casting" component={CastingCalls} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
