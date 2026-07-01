import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useUpdateMyStylistProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SignupInputRole } from "@workspace/api-client-react";

const SPECIALTIES = [
  "Makeup",
  "Hair",
  "Barber",
  "Nails",
  "Lashes",
  "Brows",
  "Skincare",
];

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupInputRole>(SignupInputRole.client);
  const [businessName, setBusinessName] = useState("");
  const [specialty, setSpecialty] = useState("Makeup");
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const updateProfile = useUpdateMyStylistProfile();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signup({
        data: {
          name,
          email,
          password,
          role,
          businessName: role === SignupInputRole.brand ? businessName : undefined,
        },
      });

      if (role === SignupInputRole.stylist && specialty !== "Makeup") {
        await updateProfile.mutateAsync({ data: { specialty } });
      }

      toast.success("Account created successfully");
      setLocation("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-8 bg-card p-8 rounded-2xl border border-border mt-10 mb-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif font-bold">Join GlamNet</h1>
          <p className="text-muted-foreground">Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>I want to use GlamNet as a:</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as SignupInputRole)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${role === SignupInputRole.client ? 'border-primary bg-primary/10' : 'border-border bg-background'}`} onClick={() => setRole(SignupInputRole.client)}>
                  <RadioGroupItem value={SignupInputRole.client} id="role-client" className="sr-only" />
                  <div className="font-semibold text-sm">Client</div>
                  <div className="text-xs text-muted-foreground mt-1">Book services</div>
                </div>
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${role === SignupInputRole.stylist ? 'border-primary bg-primary/10' : 'border-border bg-background'}`} onClick={() => setRole(SignupInputRole.stylist)}>
                  <RadioGroupItem value={SignupInputRole.stylist} id="role-stylist" className="sr-only" />
                  <div className="font-semibold text-sm">Artist / Barber</div>
                  <div className="text-xs text-muted-foreground mt-1">Offer services</div>
                </div>
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${role === SignupInputRole.brand ? 'border-primary bg-primary/10' : 'border-border bg-background'}`} onClick={() => setRole(SignupInputRole.brand)}>
                  <RadioGroupItem value={SignupInputRole.brand} id="role-brand" className="sr-only" />
                  <div className="font-semibold text-sm">Brand</div>
                  <div className="text-xs text-muted-foreground mt-1">Post castings</div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="bg-background"
              />
            </div>

            {role === SignupInputRole.stylist && (
              <div className="space-y-2">
                <Label htmlFor="specialty">Your Specialty</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger id="specialty" className="bg-background">
                    <SelectValue placeholder="Select your specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {role === SignupInputRole.brand && (
              <div className="space-y-2">
                <Label htmlFor="businessName">Brand / Agency Name</Label>
                <Input
                  id="businessName"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Lumi Beauty"
                  className="bg-background"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background"
                minLength={8}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
