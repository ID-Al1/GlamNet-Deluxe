import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { 
  useGetMyStylistProfile, 
  useUpdateMyStylistProfile, 
  useGetVerificationChecklist,
  useGetMyBankDetails,
  useUpdateMyBankDetails,
  useAddPortfolioItem,
  useDeletePortfolioItem,
  getGetVerificationChecklistQueryKey,
  getGetMyStylistProfileQueryKey,
  getGetMyBankDetailsQueryKey,
  getGetMyIdentityVerificationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import {
  User, CheckCircle2, ShieldAlert, CircleDashed, FileText, Upload,
  Clock, Calendar, Scissors, ChevronRight, CheckCheck, Plus, Camera, Banknote, Pencil, Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESET_SERVICES = [
  "Full Glam Makeup", "Natural / Everyday Makeup", "Bridal Makeup", "Bridal Party Makeup",
  "Airbrush Makeup", "Editorial / Avant-Garde Makeup", "Body Makeup", "Eyebrow Shaping & Tint",
  "Lash Application", "Makeup Lesson", "Hair Styling", "Blowout", "Updo / Formal Style",
  "Hair Braiding", "Hair Colour & Highlights", "Keratin Treatment", "Wig Fitting & Styling",
  "Manicure", "Pedicure", "Gel Nails", "Acrylic Nails", "Nail Art", "Skincare Facial",
  "Waxing", "Henna / Mehndi", "Touch-up / Refresh", "Custom",
] as const;

export function ArtistProfile() {
  const { token } = useAuth();
  const qc = useQueryClient();
  
  const { data: myProfile, isLoading: profileLoading } = useGetMyStylistProfile();
  const { data: checklist, isLoading: checklistLoading } = useGetVerificationChecklist();
  const { data: bankDetails, isLoading: bankLoading } = useGetMyBankDetails();

  // Verification / Identity state (Raw fetch as required)
  const [identityStatus, setIdentityStatus] = useState<{ idNumberProvided: boolean; idDocumentProvided: boolean } | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [identityDocument, setIdentityDocument] = useState<File | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  
  // Submit state
  const [submittingVerification, setSubmittingVerification] = useState(false);
  
  // Bank state
  const [bankForm, setBankForm] = useState({ bankName: "", accountHolderName: "", accountNumber: "", accountType: "cheque" as const });
  const updateBank = useUpdateMyBankDetails();

  // Services state
  const [newSvc, setNewSvc] = useState({ name: "", price: "", duration: "60" });
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null);
  const [editSvc, setEditSvc] = useState({ name: "", price: "", duration: "" });
  
  // Availability state
  const [avail, setAvail] = useState<string[]>([]);
  const [savingAvail, setSavingAvail] = useState(false);

  // Bio state
  const [bio, setBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  const updateProfile = useUpdateMyStylistProfile();
  const [portfolioForm, setPortfolioForm] = useState({ title: "", imageUrl: "" });
  const addPortfolio = useAddPortfolioItem();
  const deletePortfolio = useDeletePortfolioItem();

  useEffect(() => {
    if (myProfile) {
      setBio(myProfile.bio || "");
      setAvail(myProfile.availability || []);
    }
  }, [myProfile]);

  useEffect(() => {
    if (bankDetails) {
      setBankForm(f => ({ ...f, bankName: bankDetails.bankName, accountHolderName: bankDetails.accountHolderName, accountType: bankDetails.accountType as any }));
    }
  }, [bankDetails]);

  useEffect(() => {
    if (!token) return;
    void fetch(`${import.meta.env.BASE_URL}api/stylists/me/identity-verification`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      if (res.ok) setIdentityStatus(await res.json());
    });
  }, [token]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: getGetMyStylistProfileQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVerificationChecklistQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyBankDetailsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyIdentityVerificationQueryKey() });
    qc.invalidateQueries({ queryKey: ["my-stylist-profile"] });
  };

  if (profileLoading || checklistLoading || bankLoading) {
    return <Skeleton className="w-full h-96 rounded-xl" />;
  }

  if (!myProfile || !checklist) return null;

  // Compute Missing
  const hasIdentity = identityStatus?.idNumberProvided && identityStatus?.idDocumentProvided;
  const hasBank = !!bankDetails?.maskedAccountNumber || !!(bankDetails as any)?.accountNumber || !!bankDetails?.verificationStatus;
  const hasBio = (myProfile.bio?.trim().length ?? 0) >= 40;
  const hasService = (myProfile.services?.length ?? 0) > 0;
  const hasPortfolio = (myProfile.portfolio?.length ?? 0) > 0;

  const missingList = [];
  if (!hasIdentity) missingList.push("Identity documents");
  if (!hasBank) missingList.push("Bank details");
  if (!hasBio) missingList.push("Bio (min. 40 characters)");
  if (!hasService) missingList.push("At least one service");
  if (!hasPortfolio) missingList.push("At least one portfolio item");

  const canSubmit = missingList.length === 0 && checklist.verificationStatus === "none";
  const nextChecklistItem = checklist.criteria.find((criterion) => !criterion.met);
  const nextAction = !hasIdentity
    ? "Add your ID number and upload your identity document below."
    : !hasBank
    ? "Add the bank account where Bonisa should send your payouts."
    : nextChecklistItem?.hint ?? "Complete the remaining profile sections below.";

  // --- Handlers ---
  const saveBankDetails = async () => {
    if (!bankForm.bankName || !bankForm.accountHolderName || !bankForm.accountNumber) return;
    try {
      await updateBank.mutateAsync({ data: bankForm as any });
      toast.success("Bank details saved.");
      setBankForm(f => ({ ...f, accountNumber: "" }));
      refreshAll();
    } catch {
      toast.error("Could not save bank details.");
    }
  };

  const submitIdentityVerification = async () => {
    if (!idNumber.trim() || !identityDocument) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(identityDocument.type) || identityDocument.size > 10 * 1024 * 1024) {
      toast.error("Use a JPG, PNG, WEBP, or PDF identity document under 10 MB.");
      return;
    }
    setSavingIdentity(true);
    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const uploadRequest = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/identity-document/upload-url`, {
        method: "POST", headers, body: JSON.stringify({ name: identityDocument.name, size: identityDocument.size, contentType: identityDocument.type }),
      });
      if (!uploadRequest.ok) throw new Error("Could not start upload.");
      
      const { uploadURL, objectPath } = await uploadRequest.json();
      const upload = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": identityDocument.type }, body: identityDocument });
      if (!upload.ok) throw new Error("Upload failed.");

      const save = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/identity-verification`, {
        method: "PATCH", headers, body: JSON.stringify({ idNumber: idNumber.trim(), idDocumentUrl: objectPath }),
      });
      if (!save.ok) throw new Error("Save failed.");
      
      setIdentityStatus(await save.json());
      setIdNumber("");
      setIdentityDocument(null);
      toast.success("Identity details saved privately.");
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to save identity.");
    } finally {
      setSavingIdentity(false);
    }
  };

  const submitForVerification = async () => {
    setSubmittingVerification(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/verification-submit`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not submit your profile.");
      toast.success(body.message || "Profile submitted for verification.");
      refreshAll();
    } catch (e: any) {
      toast.error(e.message || "Could not submit your profile.");
    } finally {
      setSubmittingVerification(false);
    }
  };

  const addSvc = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newSvc.name, price: parseFloat(newSvc.price), duration: parseInt(newSvc.duration) }),
      });
      if (!res.ok) throw new Error("Failed to save service");
      return res.json();
    },
    onSuccess: () => {
      setNewSvc({ name: "", price: "", duration: "60" });
      toast.success("Service saved!");
      refreshAll();
    },
    onError: () => toast.error("Failed to add service"),
  });

  const updateSvc = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editSvc.name, price: parseFloat(editSvc.price), duration: parseInt(editSvc.duration) }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { setEditingSvcId(null); toast.success("Service updated!"); refreshAll(); },
    onError: () => toast.error("Failed to update service"),
  });

  const deleteSvc = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/stylists/me/services/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("Service removed"); refreshAll(); },
  });

  const saveAvailability = async () => {
    setSavingAvail(true);
    try {
      await updateProfile.mutateAsync({ data: { availability: avail } });
      toast.success("Availability saved!");
      refreshAll();
    } catch { toast.error("Could not save availability"); }
    finally { setSavingAvail(false); }
  };

  const handleHouseCallsToggle = async (enabled: boolean) => {
    await updateProfile.mutateAsync({ data: { houseCalls: enabled } as any });
    refreshAll();
  };

  const addPortfolioItem = async () => {
    const title = portfolioForm.title.trim();
    const imageUrl = portfolioForm.imageUrl.trim();
    if (!title || !imageUrl) return;
    try {
      const parsedUrl = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      await addPortfolio.mutateAsync({ data: { title, type: "image", imageUrl } });
      setPortfolioForm({ title: "", imageUrl: "" });
      toast.success("Portfolio item added");
      refreshAll();
    } catch {
      toast.error("Enter a valid public image link beginning with http:// or https://.");
    }
  };

  const deletePortfolioItem = async (id: string) => {
    try {
      await deletePortfolio.mutateAsync({ itemId: id });
      toast.success("Item removed");
      refreshAll();
    } catch { toast.error("Failed to remove item"); }
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      await updateProfile.mutateAsync({ data: { bio } as any });
      toast.success("Bio updated");
      refreshAll();
    } catch { toast.error("Failed to update bio"); } 
    finally { setSavingBio(false); }
  };

  return (
    <div className="space-y-12">
      {/* 1. Verification Status */}
      <Card className={`border ${checklist.verificationStatus === "pending" ? "border-amber-500/30 bg-amber-500/5" : checklist.verificationStatus === "verified" ? "border-green-500/30 bg-green-500/5" : "border-primary/20 bg-primary/5"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg" data-testid="text-verification-status">
            {checklist.verificationStatus === "pending" ? (
              <><Clock className="h-5 w-5 text-amber-500" /> Verification Pending</>
            ) : checklist.verificationStatus === "verified" ? (
              <><CheckCircle2 className="h-5 w-5 text-green-500" /> Profile Verified</>
            ) : (
              <><ShieldAlert className="h-5 w-5 text-primary" /> Profile Incomplete</>
            )}
          </CardTitle>
          <CardDescription>
            {checklist.verificationStatus === "pending"
              ? "Your profile is being reviewed by the Bonisa team. This usually takes 1-2 business days."
              : checklist.verificationStatus === "verified"
              ? "Your profile is fully verified and live for bookings."
              : "Complete these steps below to verify your identity and start accepting bookings."}
          </CardDescription>
        </CardHeader>
        {checklist.verificationStatus === "none" && (
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {checklist.criteria.map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/50">
                  {c.met ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <CircleDashed className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div>
                    <p className={`text-sm font-medium ${c.met ? "text-foreground" : "text-foreground/80"}`}>{c.label}</p>
                    {!c.met && <p className="text-xs text-muted-foreground mt-0.5">{c.hint}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="status-next-verification-action">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Next action</p>
              <p className="mt-1 text-sm text-foreground">{nextAction}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 2. Identity Verification */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Identity
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              We require government ID to verify artists. This information is stored securely and never shown publicly.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3" data-testid="status-identity">
              <span className="text-sm font-medium">Current status</span>
              <span className="text-sm text-muted-foreground">
                {hasIdentity ? "Identity details complete" : "Identity details required"}
              </span>
            </div>
            {!hasIdentity && (
              <p className="text-xs text-muted-foreground">
                If one item was already saved, re-enter both fields so Bonisa can store one complete, matched identity submission.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number / Passport</Label>
                <Input 
                  id="idNumber" 
                  value={idNumber} 
                  onChange={e => setIdNumber(e.target.value)} 
                  disabled={hasIdentity}
                  placeholder={identityStatus?.idNumberProvided ? "Re-enter your ID number" : "Your ID number"} 
                  data-testid="input-id-number"
                />
              </div>
              <div className="space-y-2">
                <Label>ID Document (Image or PDF)</Label>
                {hasIdentity ? (
                  <div className="h-10 px-3 bg-muted rounded-md flex items-center text-sm text-muted-foreground border border-border">
                    <CheckCheck className="h-4 w-4 mr-2 text-green-500" /> Securely uploaded
                  </div>
                ) : (
                  <Input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp,application/pdf" 
                    onChange={e => setIdentityDocument(e.target.files?.[0] || null)}
                    data-testid="input-id-document"
                  />
                )}
              </div>
            </div>
            {(!identityStatus?.idNumberProvided || !identityStatus?.idDocumentProvided) && (
              <Button onClick={submitIdentityVerification} disabled={savingIdentity || !idNumber || !identityDocument} data-testid="button-upload-identity">
                {savingIdentity ? "Uploading securely..." : "Upload Identity Document"}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 3. Bank Details */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <Banknote className="h-5 w-5 text-muted-foreground" />
          Bank Details
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              Where should we send your payouts? We'll verify this account matches your identity.
            </p>
            
            {bankDetails?.verificationStatus === "failed" && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 text-destructive text-sm" data-testid="alert-bank-failed">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <p>We couldn't verify these bank details. Please check the information and try again.</p>
              </div>
            )}
            
            {bankDetails?.verificationStatus === "verified" && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-center gap-2 text-green-700 text-sm" data-testid="alert-bank-verified">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p>Bank account verified. You are ready to receive payouts.</p>
              </div>
            )}

            {bankDetails && (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4" data-testid="status-current-bank-details">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current bank details</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Bank</p>
                    <p className="font-medium">{bankDetails.bankName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account holder</p>
                    <p className="font-medium">{bankDetails.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account</p>
                    <p className="font-medium">{bankDetails.maskedAccountNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{bankDetails.verificationStatus}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input id="bankName" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} data-testid="input-bank-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                <Input id="accountHolderName" value={bankForm.accountHolderName} onChange={e => setBankForm(f => ({ ...f, accountHolderName: e.target.value }))} data-testid="input-account-holder" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select value={bankForm.accountType} onValueChange={v => setBankForm(f => ({ ...f, accountType: v as any }))}>
                  <SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque">Cheque / Current</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input 
                  id="accountNumber" 
                  value={bankForm.accountNumber} 
                  onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} 
                  placeholder={bankDetails?.maskedAccountNumber || "Enter new account number"} 
                  type="password"
                  data-testid="input-account-number"
                />
              </div>
            </div>
            
            <Button 
              onClick={saveBankDetails} 
              disabled={updateBank.isPending || !bankForm.bankName || !bankForm.accountHolderName || !bankForm.accountNumber}
              data-testid="button-save-bank"
            >
              {updateBank.isPending ? "Saving..." : bankDetails ? "Update Bank Details" : "Save Bank Details"}
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 4. Submit Gating Section */}
      <section className="space-y-4">
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-serif font-bold text-lg">Ready for Review?</h3>
            {checklist.verificationStatus === "none" ? (
              <>
                {missingList.length > 0 ? (
                  <div className="p-4 bg-muted rounded-xl space-y-2">
                    <p className="text-sm font-medium">To submit for verification, you must complete:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                      {missingList.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Everything looks good. Submit your profile so our team can review and verify you.</p>
                )}
                <Button 
                  onClick={submitForVerification} 
                  disabled={!canSubmit || submittingVerification} 
                  className="w-full sm:w-auto"
                  data-testid="button-submit-verification"
                >
                  {submittingVerification ? "Submitting..." : "Submit profile for verification"}
                </Button>
              </>
            ) : (
              <p className="text-sm font-medium" data-testid="text-verification-state">
                {checklist.verificationStatus === "pending" ? "Your profile is currently under review." : "Your profile is fully verified."}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 5. Portfolio */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          Portfolio
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {myProfile.portfolio?.map(item => (
                <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Camera className="h-8 w-8 opacity-20" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="destructive" size="sm" onClick={() => deletePortfolioItem(item.id)} data-testid={`button-delete-portfolio-${item.id}`}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4 border-t border-border/50 pt-4">
              <div>
                <h3 className="text-sm font-semibold">Add portfolio item</h3>
                <p className="mt-1 text-xs text-muted-foreground">Use a public image link from your website or portfolio host.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="portfolioTitle" className="text-xs">Title</Label>
                  <Input id="portfolioTitle" value={portfolioForm.title} onChange={(event) => setPortfolioForm((current) => ({ ...current, title: event.target.value }))} placeholder="Bridal glam" data-testid="input-portfolio-title" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="portfolioImageUrl" className="text-xs">Public image link</Label>
                  <Input id="portfolioImageUrl" type="url" value={portfolioForm.imageUrl} onChange={(event) => setPortfolioForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://…" data-testid="input-portfolio-image-url" />
                </div>
              </div>
              <Button onClick={addPortfolioItem} disabled={addPortfolio.isPending || !portfolioForm.title.trim() || !portfolioForm.imageUrl.trim()} data-testid="button-add-portfolio">
                {addPortfolio.isPending ? "Adding..." : "Add portfolio item"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. Services */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <Scissors className="h-5 w-5 text-muted-foreground" />
          Services
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-3">
              {myProfile.services?.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">R{s.price} • {s.duration} mins</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingSvcId(s.id); setEditSvc({ name: s.name, price: s.price.toString(), duration: s.duration.toString() }); }} data-testid={`button-edit-service-${s.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteSvc.mutate(s.id)} disabled={deleteSvc.isPending} data-testid={`button-delete-service-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!myProfile.services || myProfile.services.length === 0) && (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-xl">No services listed yet. Add one to start taking bookings.</div>
              )}
            </div>

            <div className="pt-4 border-t border-border/50 space-y-4">
              <h3 className="text-sm font-semibold">Add New Service</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Service Name</Label>
                  <Input value={newSvc.name} onChange={e => setNewSvc({ ...newSvc, name: e.target.value })} placeholder="e.g. Bridal Makeup" list="service-presets" data-testid="input-service-name" />
                  <datalist id="service-presets">{PRESET_SERVICES.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (R)</Label>
                  <Input type="number" min="0" step="10" value={newSvc.price} onChange={e => setNewSvc({ ...newSvc, price: e.target.value })} placeholder="500" data-testid="input-service-price" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration (mins)</Label>
                  <Select value={newSvc.duration} onValueChange={v => setNewSvc({ ...newSvc, duration: v })}>
                    <SelectTrigger data-testid="select-service-duration"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 mins</SelectItem>
                      <SelectItem value="45">45 mins</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => addSvc.mutate()} disabled={!newSvc.name || !newSvc.price || addSvc.isPending} className="w-full" data-testid="button-add-service">
                {addSvc.isPending ? "Adding..." : "Add Service"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 7 & 8. Availability & House Calls */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Availability & Location
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <Label>Working Days</Label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {DAYS.map(day => {
                  const active = avail.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => setAvail(p => active ? p.filter(d => d !== day) : [...p, day])}
                      className={`p-2 rounded-xl text-xs font-semibold transition-all border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                      data-testid={`button-day-${day}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={saveAvailability} disabled={savingAvail} data-testid="button-save-availability">
                  {savingAvail ? "Saving..." : "Save Days"}
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label>House Calls</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Will you travel to the client's location?</p>
                </div>
                <Switch checked={myProfile.houseCalls || false} onCheckedChange={handleHouseCallsToggle} data-testid="switch-house-calls" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 9. Public Profile & Bio */}
      <section className="space-y-4">
        <h2 className="text-xl font-serif font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          Public Profile
        </h2>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="bio">Your Bio</Label>
                {(!myProfile.bio || !myProfile.location || !myProfile.area || !myProfile.availability?.length) && (
                  <Link href="/profile/setup" className="text-xs text-primary hover:underline">Launch setup wizard</Link>
                )}
              </div>
              <Textarea 
                id="bio" 
                rows={4} 
                value={bio} 
                onChange={e => setBio(e.target.value)} 
                placeholder="Tell clients about your experience and style..." 
                data-testid="textarea-bio"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={saveBio} disabled={savingBio || bio === myProfile.bio} data-testid="button-save-bio">
                  {savingBio ? "Saving..." : "Save Bio"}
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <Link href={`/stylists/${myProfile.id}`}>
                <Button variant="outline" className="w-full" data-testid="button-view-public-profile">View Public Profile <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Edit Service Dialog */}
      <Dialog open={!!editingSvcId} onOpenChange={(o) => !o && setEditingSvcId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editSvc.name} onChange={e => setEditSvc({ ...editSvc, name: e.target.value })} data-testid="input-edit-service-name" />
            </div>
            <div className="space-y-2">
              <Label>Price (R)</Label>
              <Input type="number" value={editSvc.price} onChange={e => setEditSvc({ ...editSvc, price: e.target.value })} data-testid="input-edit-service-price" />
            </div>
            <div className="space-y-2">
              <Label>Duration (mins)</Label>
              <Select value={editSvc.duration} onValueChange={v => setEditSvc({ ...editSvc, duration: v })}>
                <SelectTrigger data-testid="select-edit-service-duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="45">45 mins</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSvcId(null)}>Cancel</Button>
            <Button onClick={() => updateSvc.mutate(editingSvcId!)} disabled={updateSvc.isPending} data-testid="button-save-edit-service">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
