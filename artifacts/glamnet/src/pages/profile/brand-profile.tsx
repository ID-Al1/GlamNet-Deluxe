import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";

export function BrandProfile() {
  const { user, logout } = useAuth();
  
  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</Label>
              <p className="font-medium text-foreground">{user?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</Label>
              <p className="text-foreground">{user?.email}</p>
            </div>
            {user?.businessName && (
              <div className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Business Name</Label>
                <p className="font-medium text-foreground">{user.businessName}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t border-border/50 py-4 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Joined {new Date(user?.createdAt || "").toLocaleDateString()}</p>
          <Button variant="ghost" onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="button-signout">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
