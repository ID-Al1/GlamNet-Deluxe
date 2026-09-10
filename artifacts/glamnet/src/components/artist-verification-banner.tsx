import {
  getGetMyBankDetailsQueryKey,
  getGetMyIdentityVerificationQueryKey,
  getGetMyStylistProfileQueryKey,
  useGetMyBankDetails,
  useGetMyIdentityVerification,
  useGetMyStylistProfile,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

export function ArtistVerificationBanner() {
  const { user } = useAuth();
  const isArtist = user?.role === "stylist" && !user.isOwner;
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useGetMyStylistProfile({
    query: {
      queryKey: getGetMyStylistProfileQueryKey(),
      enabled: isArtist,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });
  const {
    data: identity,
    isLoading: identityLoading,
    isError: identityError,
  } = useGetMyIdentityVerification({
    query: {
      queryKey: getGetMyIdentityVerificationQueryKey(),
      enabled: isArtist,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });
  const {
    data: bank,
    isLoading: bankLoading,
    isError: bankError,
  } = useGetMyBankDetails({
    query: {
      queryKey: getGetMyBankDetailsQueryKey(),
      enabled: isArtist,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  if (!isArtist || profileLoading) return null;
  if (profile?.verified) return null;

  const requirementsLoading = identityLoading || bankLoading;
  const requirementsError = profileError || identityError || bankError || !profile;

  const missing: string[] = [];
  if (!requirementsLoading && !requirementsError && profile) {
    if (!identity?.idNumberProvided) missing.push("ID number");
    if (!identity?.idDocumentProvided) missing.push("ID document");
    if (!bank) missing.push("Bank details");
    if ((profile.bio?.trim().length ?? 0) < 40) missing.push("Bio");
    if ((profile.services?.length ?? 0) === 0) missing.push("Services");
    if ((profile.portfolio?.length ?? 0) === 0) missing.push("Portfolio");
  }

  const detail = requirementsError
    ? "We could not load your outstanding requirements. Open your profile to check them."
    : requirementsLoading
    ? "Checking what is still missing..."
    : missing.length > 0
    ? `Still missing: ${missing.join(", ")}.`
    : "Everything is complete. Your profile is waiting for Bonisa approval.";

  return (
    <div className="border-b border-primary/25 bg-primary/10" role="status" data-testid="banner-artist-verification">
      <div className="container max-w-6xl px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">You are not visible to clients yet.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
          <Link href="/profile" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Finish profile
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}