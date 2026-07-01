import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import ClientDashboard from "./dashboards/client-dashboard";
import StylistDashboard from "./dashboards/stylist-dashboard";
import BrandDashboard from "./dashboards/brand-dashboard";

export default function DashboardRouter() {
  const { user } = useAuth();

  if (!user) return <Redirect to="/login" />;

  switch (user.role) {
    case "client":
      return <ClientDashboard />;
    case "stylist":
      return <StylistDashboard />;
    case "brand":
      return <BrandDashboard />;
    default:
      return <div className="p-8 text-center text-destructive">Invalid role</div>;
  }
}
