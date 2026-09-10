import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

export function OwnerProfile() {
  const { user, logout } = useAuth();
  
  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</Label>
            <p className="font-medium text-foreground">{user?.name}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</Label>
            <p className="text-foreground">{user?.email}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Role</Label>
            <div className="flex items-center gap-2">
              <span className="capitalize text-foreground font-medium">Owner</span>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary">Owner Standing</Badge>
            </div>
          </div>
          <div className="pt-4 border-t border-border/50">
            <Button variant="destructive" className="w-full sm:w-auto" onClick={logout} data-testid="button-signout">
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
