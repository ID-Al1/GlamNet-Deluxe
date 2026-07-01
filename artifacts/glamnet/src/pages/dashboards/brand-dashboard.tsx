import { useGetBrandDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Users, DollarSign, Target } from "lucide-react";

export default function BrandDashboard() {
  const { data: dashboard, isLoading, error } = useGetBrandDashboard();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-center text-destructive">Failed to load dashboard</div>;
  if (!dashboard) return null;

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Brand Operations</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Castings</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.activeCastingCalls}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Applications</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.totalApplications}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">R{dashboard.totalSpend.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Size</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold">{dashboard.teamSize}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="castings" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="castings">Active Castings</TabsTrigger>
          <TabsTrigger value="applications">Recent Applications</TabsTrigger>
        </TabsList>
        <TabsContent value="castings" className="space-y-4">
          {dashboard.topCastingCalls && dashboard.topCastingCalls.length > 0 ? (
             <div className="grid gap-4">
               {dashboard.topCastingCalls.map(call => (
                 <Card key={call.id} className="p-6 border-border/50">
                   <div className="flex justify-between items-start">
                     <div>
                       <h3 className="font-serif text-xl font-bold">{call.title}</h3>
                       <p className="text-muted-foreground mt-1">{call.specialty}</p>
                     </div>
                     <div className="text-right">
                       <p className="font-medium">{call.budget}</p>
                       <p className="text-sm text-muted-foreground">Due: {new Date(call.deadline).toLocaleDateString()}</p>
                     </div>
                   </div>
                   <div className="mt-4">
                     <span className="text-sm font-medium">{call.applicantCount} Applicants</span>
                   </div>
                 </Card>
               ))}
             </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground">No active casting calls</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="applications">
          {dashboard.recentApplications && dashboard.recentApplications.length > 0 ? (
             <div className="space-y-4">
               {dashboard.recentApplications.map(app => (
                 <Card key={app.id} className="p-4 flex items-center justify-between border-border/50">
                   <div>
                     <p className="font-medium">{app.stylistName}</p>
                     <p className="text-sm text-muted-foreground">Applied for: {app.castingTitle}</p>
                   </div>
                   <div className={`px-2 py-1 text-xs font-semibold uppercase rounded-md ${
                     app.status === 'accepted' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                   }`}>
                     {app.status}
                   </div>
                 </Card>
               ))}
             </div>
          ) : (
            <div className="text-center py-12 border rounded-xl border-dashed border-border/50">
              <p className="text-muted-foreground">No recent applications</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
