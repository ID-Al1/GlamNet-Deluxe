import { useParams, Link } from "wouter";
import { useGetOwnerRegistryProfile, getGetOwnerRegistryProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  ArrowLeft, Mail, Phone, Building2, MapPin, 
  Calendar, ShieldCheck, CheckCircle2, Clock,
  FileText, Scissors, User, AlertCircle
} from "lucide-react";

function authHeaders(): HeadersInit {
  try {
    const stored = localStorage.getItem("glamnet_auth");
    const token = stored ? JSON.parse(stored)?.token : null;
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export default function OwnerRegistryProfile() {
  const params = useParams<{ userId: string }>();
  
  const { data: profile, isLoading, error } = useGetOwnerRegistryProfile(params.userId!, {
    query: { 
      enabled: !!params.userId, 
      queryKey: getGetOwnerRegistryProfileQueryKey(params.userId!) 
    }
  });

  async function reviewIdentity() {
    if (!profile?.artist) return;
    const preview = window.open("", "_blank");
    if (!preview) {
      toast.error("Allow pop-ups to review the private identity document.");
      return;
    }
    preview.opener = null;
    try {
      const documentResponse = await fetch(`/api/owner/artists/${profile.artist.profileId}/identity-document`, { headers: authHeaders() });
      if (!documentResponse.ok) throw new Error();
      const documentUrl = URL.createObjectURL(await documentResponse.blob());
      preview.location.href = documentUrl;
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
      toast.success("Identity document opened securely.");
    } catch {
      preview.close();
      toast.error(`Could not open ${profile.name}'s private identity document.`);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border/50 md:col-span-1"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
          <Card className="border-border/50 md:col-span-2"><CardContent className="h-64 pt-6"><Skeleton className="h-full w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-12 text-center space-y-4">
        <User className="h-12 w-12 text-destructive mx-auto" strokeWidth={1.9} />
        <h2 className="text-xl font-serif">Profile not found</h2>
        <p className="text-muted-foreground text-sm">Could not load details for this user.</p>
        <Link href="/owner/registry" className="inline-block mt-4 text-primary hover:underline text-sm">
          Return to Registry
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Link 
        href="/owner/registry" 
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        data-testid="link-back-registry"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" strokeWidth={1.9} />
        Back to Registry
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="font-serif text-3xl mb-1 flex items-center gap-3">
            {profile.name}
            {profile.artist?.verified && (
              <CheckCircle2 className="h-6 w-6 text-primary" strokeWidth={1.9} />
            )}
          </h1>
          <div className="flex items-center gap-2 text-sm mt-2">
            <Badge variant="secondary" className="capitalize">
              {profile.role === 'stylist' ? 'Artist' : profile.role}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.9} />
              Joined {format(new Date(profile.joinedAt), "PP")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-base font-serif">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
                <div className="break-all font-medium" data-testid="text-profile-email">{profile.email}</div>
              </div>
              
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
                <div className="font-medium" data-testid="text-profile-phone">
                  {profile.phone || <span className="text-muted-foreground italic font-normal">No phone provided</span>}
                </div>
              </div>

              {profile.businessName && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
                  <div className="font-medium" data-testid="text-profile-business">{profile.businessName}</div>
                </div>
              )}
              
              <div className="flex items-start gap-3 pt-2 border-t border-border/30 mt-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
                <div className="font-mono text-xs text-muted-foreground mt-0.5 break-all" data-testid="text-profile-id">
                  ID: {profile.userId}
                </div>
              </div>
            </CardContent>
          </Card>

          {profile.artist && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-base font-serif">Verification Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge 
                    variant={profile.artist.verificationStatus === 'verified' ? 'secondary' : 'outline'}
                    data-testid="badge-verification-status"
                  >
                    {profile.artist.verificationStatus}
                  </Badge>
                </div>
                
                {profile.artist.identityDocumentAvailable ? (
                  <div className="pt-4 border-t border-border/30 mt-2">
                    <p className="text-muted-foreground text-xs mb-3">Identity document is securely stored.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2" 
                      onClick={reviewIdentity}
                      data-testid="btn-review-id"
                    >
                      <FileText className="h-4 w-4" strokeWidth={1.9} />
                      Review ID Document
                    </Button>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                    <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                    No identity document uploaded.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2 space-y-6">
          {profile.artist ? (
            <>
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-base font-serif">Artist Professional Data</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Specialty</div>
                      <div className="font-medium text-base" data-testid="text-artist-specialty">{profile.artist.specialty || "Not specified"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Area / Location</div>
                      <div className="font-medium text-base flex items-start gap-1.5" data-testid="text-artist-location">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.9} />
                        <span>{profile.artist.area ? `${profile.artist.area}, ${profile.artist.location}` : profile.artist.location || "Not specified"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Portfolio Items</div>
                      <div className="font-medium text-base flex items-center gap-1.5">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">{profile.artist.portfolioItemCount}</span>
                        published
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50">
                <CardHeader className="pb-3 border-b border-border/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-serif">Services ({profile.artist.services.length})</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
                </CardHeader>
                <CardContent className="pt-4 p-0 sm:p-4 sm:pt-4">
                  {profile.artist.services.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6 px-4">
                      No services listed yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {profile.artist.services.map((service) => (
                        <div key={service.id} className="py-3 px-4 sm:px-2 flex justify-between items-center group">
                          <div>
                            <div className="font-medium text-sm transition-colors">{service.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.9} />
                              {service.duration} mins
                            </div>
                          </div>
                          <div className="font-semibold text-sm bg-muted/50 px-3 py-1 rounded-md">
                            R {service.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card border-border/50 h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center py-12">
                <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.9} />
                <h3 className="font-medium mb-1">Not an Artist</h3>
                <p className="text-sm text-muted-foreground">
                  This user is a {profile.role} and does not have an artist profile.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
