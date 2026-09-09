import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateComplaint, useAttachComplaintEvidence, useRequestUploadUrl, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Paperclip, X, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import type { ComplaintCategory, ComplaintEvidenceInputMimeType } from "@workspace/api-client-react";

export default function NewComplaint() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const initialAppointmentId = searchParams.get("appointmentId") || "";
  const subjectUserId = searchParams.get("subjectUserId") || undefined;

  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createComplaint = useCreateComplaint();
  const requestUpload = useRequestUploadUrl();
  const attachEvidence = useAttachComplaintEvidence();
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles = Array.from(e.target.files);

    const validFiles = newFiles.filter(file => {
      const isType = ["image/jpeg", "image/png", "application/pdf", "video/mp4"].includes(file.type);
      const isSize = file.size <= 20 * 1024 * 1024; // 20MB max
      if (!isType) toast.error(`${file.name} is not a supported file type`);
      if (!isSize) toast.error(`${file.name} is too large (max 20MB)`);
      return isType && isSize;
    });

    if (files.length + validFiles.length > 10) {
      toast.error("Maximum 10 files allowed");
      setFiles(prev => [...prev, ...validFiles].slice(0, 10));
    } else {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description.trim()) {
      toast.error("Please select a category and provide details");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create complaint
      const complaint = await createComplaint.mutateAsync({
        data: {
          category,
          description: description.trim(),
          appointmentId: appointmentId.trim() || undefined,
          subjectUserId
        }
      });

      // 2. Upload and attach evidence
      if (files.length > 0) {
        for (const file of files) {
          try {
            // Get URL
            const { uploadURL, objectPath } = await requestUpload.mutateAsync({
              data: {
                name: file.name,
                size: file.size,
                contentType: file.type
              }
            });

            // Upload directly to storage
            const uploadRes = await fetch(uploadURL, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file
            });

            if (!uploadRes.ok) throw new Error("Upload failed");

            // Link to complaint
            await attachEvidence.mutateAsync({
              complaintId: complaint.id,
              data: {
                objectPath,
                mimeType: file.type as ComplaintEvidenceInputMimeType
              }
            });
          } catch (err) {
            console.error(err);
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      }

      toast.success("Case opened successfully");
      queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      setLocation(`/complaints/${complaint.id}`);
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to open case");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl px-4 py-8 mx-auto">
      <Link href="/complaints" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft strokeWidth={1.9} className="w-4 h-4 mr-1" /> Back to My Cases
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Report a Problem</h1>
        <p className="text-muted-foreground mt-2">
          Bonisa takes your safety and satisfaction seriously. Please provide as much detail as possible. Cases are handled confidentially.
        </p>
      </div>

      {subjectUserId && (
        <div className="mb-6 p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-secondary-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
          <div>
            <h3 className="text-sm font-semibold text-secondary-foreground">Reporting a user</h3>
            <p className="text-xs text-muted-foreground mt-1">
              You are opening a case linked from a conversation. We will review the chat history and the user's account.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 sm:p-8 rounded-2xl border border-border/50 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="category">What is this regarding?</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="Select an issue type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="didnt_arrive">Artist didn't arrive</SelectItem>
              <SelectItem value="poor_service">Poor service quality</SelectItem>
              <SelectItem value="payment_issue">Payment or pricing issue</SelectItem>
              <SelectItem value="refund_request">Refund request</SelectItem>
              <SelectItem value="behaviour">Inappropriate behaviour</SelectItem>
              <SelectItem value="safety_concern">Safety concern</SelectItem>
              <SelectItem value="false_review">False or malicious review</SelectItem>
              <SelectItem value="harassment">Harassment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointment">Booking Reference (Optional)</Label>
          <Input
            id="appointment"
            placeholder="e.g. Booking ID if related to a specific appointment"
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">If this issue is related to a booking, providing the ID helps us resolve it faster.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Details</Label>
          <Textarea
            id="description"
            placeholder="Please explain what happened..."
            className="min-h-[150px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={10000}
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-border/40">
          <div>
            <Label>Evidence (Optional)</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Upload photos, screenshots, or videos. Max 10 files, 20MB each. Supported: JPG, PNG, PDF, MP4.</p>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 border border-border/50 rounded-lg text-sm">
                  <span className="truncate pr-2 font-medium">{file.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X strokeWidth={1.9} className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/jpeg,image/png,application/pdf,video/mp4"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= 10 || isSubmitting}
            className="w-full sm:w-auto gap-2"
          >
            <Paperclip strokeWidth={1.9} className="w-4 h-4" />
            Attach Files
          </Button>
        </div>

        <div className="pt-6 flex justify-end">
          <Button type="submit" disabled={isSubmitting || !category || !description.trim()} className="w-full sm:w-auto min-w-[150px] rounded-full">
            {isSubmitting ? <Loader2 strokeWidth={1.9} className="w-4 h-4 animate-spin mr-2" /> : <ShieldAlert strokeWidth={1.9} className="w-4 h-4 mr-2" />}
            Submit Case
          </Button>
        </div>
      </form>
    </div>
  );
}