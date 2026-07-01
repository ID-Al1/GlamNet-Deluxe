import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SignupInputRole } from "@workspace/api-client-react";
import { Palette, User, Briefcase } from "lucide-react";

const SPECIALTIES = ["Makeup", "Hair", "Barber", "Nails", "Lashes", "Brows", "Skincare"];

const ROLES = [
  { value: SignupInputRole.client, icon: User, label: "Client", desc: "Book beauty services" },
  { value: SignupInputRole.stylist, icon: Palette, label: "Artist / Barber", desc: "Offer your services" },
  { value: SignupInputRole.brand, icon: Briefcase, label: "Brand", desc: "Post casting calls" },
];

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupInputRole>(SignupInputRole.client);
  const [businessName, setBusinessName] = useState("");
  const [specialty, setSpecialty] = useState("Makeup");
  const [referralCode, setReferralCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  // Pre-fill referral code from URL ?ref=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, []);

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
          ...(referralCode ? { referralCode } : {}),
        } as any,
      });
      toast.success("Account created — let's set up your profile!");
      if (role === SignupInputRole.stylist) {
        setLocation("/profile/setup");
      } else {
        setLocation("/dashboard");
      }
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
            {/* Role selection */}
            <div className="space-y-3">
              <Label>I want to use GlamNet as a:</Label>
              <RadioGroup value={role} onValueChange={v => setRole(v as SignupInputRole)} className="grid grid-cols-3 gap-3">
                {ROLES.map(({ value, icon: Icon, label, desc }) => (
                  <div
                    key={value}
                    onClick={() => setRole(value)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all space-y-2 ${
                      role === value ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value={value} className="sr-only" />
                    <Icon className={`h-5 w-5 ${role === value ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="font-semibold text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Full name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
              <Input id="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Dlamini" className="bg-background" />
            </div>

            {/* Specialty (artists only) */}
            {role === SignupInputRole.stylist && (
              <div className="space-y-2">
                <Label htmlFor="specialty">Your Specialty <span className="text-destructive">*</span></Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger id="specialty" className="bg-background">
                    <SelectValue placeholder="Select your specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Brand name */}
            {role === SignupInputRole.brand && (
              <div className="space-y-2">
                <Label htmlFor="businessName">Brand / Agency Name <span className="text-destructive">*</span></Label>
                <Input id="businessName" required value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Lumi Beauty SA" className="bg-background" />
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="bg-background" />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="bg-background" minLength={8} />
            </div>

            {/* Referral code */}
            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="referralCode"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD34EF"
                className="bg-background font-mono tracking-wider"
                maxLength={20}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
            {isLoading ? "Creating account…" : role === SignupInputRole.stylist ? "Create account & set up profile →" : "Create Account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Log in</Link>
        </div>
      </div>
    </div>
  );
}
