import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

async function fetchAppointment(id: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Appointment not found");
  return res.json();
}

async function submitReview(data: { appointmentId: string; stylistId: string; rating: number; text: string }) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit review");
  }
  return res.json();
}

export default function LeaveReview() {
  const [, params] = useRoute("/reviews/:appointmentId");
  const appointmentId = params?.appointmentId ?? "";
  const [, setLocation] = useLocation();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");

  const { data: appt, isLoading, error } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointment(appointmentId),
    enabled: !!appointmentId,
  });

  const review = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      toast.success("Review submitted — thank you!");
      setLocation("/dashboard");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit review");
    },
  });

  if (isLoading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (error || !appt) return <div className="p-12 text-center text-destructive">Appointment not found</div>;
  if (appt.status !== "completed") return <div className="p-12 text-center text-muted-foreground">This appointment isn't marked as completed yet.</div>;

  const handleSubmit = () => {
    if (rating === 0) { toast.error("Please select a star rating."); return; }
    review.mutate({ appointmentId, stylistId: appt.stylistId, rating, text });
  };

  return (
    <div className="container py-12 max-w-lg px-4">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">Leave a Review</h1>
          <p className="text-muted-foreground">
            How was your experience with <strong>{appt.stylistName}</strong> for {appt.serviceName}?
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Star rating */}
            <div className="space-y-3">
              <p className="font-medium">Your rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        star <= (hovered || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm text-muted-foreground">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </p>
              )}
            </div>

            {/* Optional text */}
            <div className="space-y-2">
              <p className="font-medium">Comments <span className="text-muted-foreground text-sm">(optional)</span></p>
              <Textarea
                placeholder="Share your experience..."
                value={text}
                onChange={e => setText(e.target.value)}
                className="resize-none h-28"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{text.length}/500</p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || review.isPending}
              className="w-full h-12 text-base"
            >
              {review.isPending ? "Submitting…" : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
