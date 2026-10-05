import { getListMyArtistUpdatesQueryKey, useListMyArtistUpdates } from "@workspace/api-client-react";
import { ArrowRight, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

/** Tells an artist, on any page, that Bonisa has sent her something new. */
export function ArtistUpdatesBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isArtist = user?.role === "stylist" && !user.isOwner;
  const { data: updates } = useListMyArtistUpdates({
    query: {
      queryKey: getListMyArtistUpdatesQueryKey(),
      enabled: isArtist,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  });

  const unread = (updates ?? []).filter((u) => !u.readAt);
  if (!isArtist || location === "/updates" || unread.length === 0) return null;

  return (
    <div className="border-b border-border/60 bg-muted/30" role="status" data-testid="banner-artist-updates">
      <div className="container max-w-6xl px-4 py-3">
        <Link href="/updates" className="flex items-center gap-3">
          <Bell className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">
              {unread.length === 1 ? "New update from Bonisa: " : `${unread.length} new updates from Bonisa. Latest: `}
            </span>
            <span className="text-muted-foreground">{unread[0]!.subject}</span>
          </p>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Read
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </div>
  );
}
