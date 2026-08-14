import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Star, Loader2, ImagePlus, X, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useUpload } from "@workspace/object-storage-web";

async function fetchAppointment(id: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/appointments/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Appointment not found");
  return res.json();
}

async function submitReview(data: {
  appointmentId: string;
  stylistId: string;
  rating: number;
  text: string;
  mediaItems: { path: string; mimeType: string }[];
}) {
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

interface MediaPreview {
  file: File;
  previewUrl: string;
  objectPath?: string;
  uploading: boolean;
  error?: string;
}

export default function LeaveReview() {
  const [, params] = useRoute("/reviews/:appointmentId");
  const appointmentId = params?.appointmentId ?? "";
  const [, setLocation] = useLocation();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile } = useUpload({
    basePath: `${import.meta.env.BASE_URL}api/storage`,
  });

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (media.length + files.length > 5) {
      toast.error("You can attach up to 5 photos/videos per review.");
      return;
    }

    const newEntries: MediaPreview[] = files.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      uploading: true,
    }));
    setMedia(prev => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      const result = await uploadFile(entry.file);
      setMedia(prev => prev.map(m =>
        m.previewUrl === entry.previewUrl
          ? { ...m, uploading: false, objectPath: result?.objectPath, error: result ? undefined : "Upload failed" }
          : m
      ));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (previewUrl: string) => {
    setMedia(prev => prev.filter(m => m.previewUrl !== previewUrl));
  };

  const handleSubmit = () => {
    if (rating === 0) { toast.error("Please select a star rating."); return; }
    const uploading = media.some(m => m.uploading);
    if (uploading) { toast.error("Please wait for media to finish uploading."); return; }
    const mediaItems = media
      .filter(m => m.objectPath)
      .map(m => ({ path: m.objectPath!, mimeType: m.file.type || "application/octet-stream" }));
    review.mutate({ appointmentId, stylistId: appt.stylistId, rating, text, mediaItems });
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (error || !appt) return <div className="p-12 text-center text-destructive">Appointment not found</div>;
  if (appt.status !== "completed") return <div className="p-12 text-center text-muted-foreground">This appointment isn't marked as completed yet.</div>;

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
              <p id="rating-label" className="font-medium">Your rating</p>
              <div
                role="radiogroup"
                aria-labelledby="rating-label"
                aria-required="true"
                className="flex gap-2"
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded-sm"
                  >
                    <Star
                      aria-hidden="true"
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
                <p className="text-sm text-muted-foreground" aria-live="polite">
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

            {/* Media attachments */}
            <div className="space-y-3">
              <p className="font-medium">Photos & videos <span className="text-muted-foreground text-sm">(optional, up to 5)</span></p>

              {media.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {media.map(m => (
                    <div key={m.previewUrl} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted">
                      {m.file.type.startsWith("video/") ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Film className="h-6 w-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={m.previewUrl} alt="attachment" className="w-full h-full object-cover" />
                      )}
                      {m.uploading && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      {m.error && (
                        <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                          <span className="text-xs text-white font-medium">Error</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.previewUrl)}
                        className="absolute top-0.5 right-0.5 bg-background/90 rounded-full p-0.5 shadow"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {media.length < 5 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add photos or videos
                  </Button>
                </>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || review.isPending || media.some(m => m.uploading)}
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
