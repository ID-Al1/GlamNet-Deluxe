import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useUpdateMyStylistProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, MapPin, FileText, Clock, Instagram, ChevronRight, ChevronLeft, Scissors } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STEPS = [
  { id: 1, label: "Your Story", icon: FileText, desc: "Tell clients who you are" },
  { id: 2, label: "Availability", icon: Clock, desc: "When can clients book you?" },
  { id: 3, label: "Your Links", icon: Instagram, desc: "Connect your socials" },
];

export default function ProfileSetup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateMyStylistProfile();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    bio: "",
    location: "",
    area: "",
    availability: [] as string[],
    instagram: "",
    website: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(p => ({ ...p, [key]: val }));

  const toggleDay = (day: string) =>
    setForm(p => ({
      ...p,
      availability: p.availability.includes(day)
        ? p.availability.filter(d => d !== day)
        : [...p.availability, day],
    }));

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!form.bio || form.bio.trim().length < 40)
        e.bio = "Bio must be at least 40 characters so clients know you well.";
      if (!form.location.trim())
        e.location = "City is required.";
      if (!form.area.trim())
        e.area = "Area / suburb is required.";
    }
    if (step === 2) {
      if (form.availability.length === 0)
        e.availability = "Select at least one working day.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEPS.length) {
      setStep(s => s + 1);
    }
  };

  const handleFinish = async () => {
    if (!validateStep()) return;
    try {
      await updateProfile.mutateAsync({
        data: {
          bio: form.bio,
          location: form.location,
          area: form.area,
          availability: form.availability,
          ...(form.instagram ? { instagram: form.instagram } : {}),
          ...(form.website ? { website: form.website } : {}),
        },
      });
      toast.success("Profile saved! You're all set.");
      setLocation("/dashboard");
    } catch {
      toast.error("Could not save your profile. Please try again.");
    }
  };

  const isArtist = user?.role === "stylist";

  // Redirect non-stylist users safely inside an effect, never during render
  useEffect(() => {
    if (!isArtist) {
      setLocation("/dashboard");
    }
  }, [isArtist, setLocation]);

  if (!isArtist) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-10">
          <Scissors className="h-5 w-5 text-primary rotate-45" />
          <span className="font-serif font-bold text-xl">GlamNet</span>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    done ? "bg-primary text-primary-foreground" :
                    active ? "bg-primary/20 text-primary border-2 border-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-serif font-bold">{STEPS[step - 1].label}</h2>
            <p className="text-muted-foreground text-sm mt-1">{STEPS[step - 1].desc}</p>
          </div>

          {/* Step 1: Your Story */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="bio">
                  Bio <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-1 text-xs">— min 40 characters</span>
                </Label>
                <Textarea
                  id="bio"
                  rows={4}
                  placeholder="I'm a certified makeup artist with 5 years of experience specialising in bridal and editorial looks across Johannesburg…"
                  value={form.bio}
                  onChange={e => set("bio")(e.target.value)}
                  className={`bg-background resize-none ${errors.bio ? "border-destructive" : ""}`}
                />
                <div className="flex justify-between items-center">
                  {errors.bio ? (
                    <p className="text-xs text-destructive">{errors.bio}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Clients book artists they feel they know</p>
                  )}
                  <span className={`text-xs ${form.bio.length >= 40 ? "text-primary" : "text-muted-foreground"}`}>
                    {form.bio.length}/40
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">
                    <MapPin className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="location"
                    placeholder="Johannesburg"
                    value={form.location}
                    onChange={e => set("location")(e.target.value)}
                    className={`bg-background ${errors.location ? "border-destructive" : ""}`}
                  />
                  {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">
                    Area / Suburb <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="area"
                    placeholder="Sandton"
                    value={form.area}
                    onChange={e => set("area")(e.target.value)}
                    className={`bg-background ${errors.area ? "border-destructive" : ""}`}
                  />
                  {errors.area && <p className="text-xs text-destructive">{errors.area}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Availability */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick the days you're typically available. Clients will only be able to book you on these days.
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map(day => {
                  const selected = form.availability.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`p-3 rounded-xl text-sm font-semibold transition-all border ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {errors.availability && <p className="text-xs text-destructive">{errors.availability}</p>}
              {form.availability.length > 0 && (
                <p className="text-sm text-primary font-medium">
                  ✓ Available {form.availability.length} day{form.availability.length !== 1 ? "s" : ""} a week
                </p>
              )}
            </div>
          )}

          {/* Step 3: Socials */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram handle</Label>
                <div className="flex items-center">
                  <span className="bg-muted border border-r-0 border-border rounded-l-lg px-3 py-2 text-sm text-muted-foreground">@</span>
                  <Input
                    id="instagram"
                    placeholder="yourusername"
                    value={form.instagram.replace(/^@/, "")}
                    onChange={e => set("instagram")(e.target.value)}
                    className="bg-background rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Your best portfolio is already on social — link it here.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input
                  id="website"
                  placeholder="https://yoursite.co.za"
                  value={form.website}
                  onChange={e => set("website")(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Almost done!</p>
                You can skip socials for now and add them later from your profile settings. The important thing is getting your studio live.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
                <ChevronLeft className="h-4 w-4" />Back
              </Button>
            )}
            {step < STEPS.length ? (
              <Button type="button" onClick={next} className="flex-1 gap-2">
                Continue<ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinish}
                className="flex-1 gap-2"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Saving…" : "Finish setup →"}
              </Button>
            )}
          </div>

          {step < STEPS.length && (
            <button
              type="button"
              onClick={() => setLocation("/dashboard")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now — I'll set up my profile later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
