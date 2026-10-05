import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import {
  getListMyArtistUpdatesQueryKey,
  useListMyArtistUpdates,
  useMarkMyArtistUpdatesRead,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Bell, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * The artist's Updates inbox: everything Bonisa has sent her, in one place,
 * whether or not she gave us a phone number or reads her email.
 */
export default function ArtistUpdatesInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isArtist = user?.role === "stylist" && !user.isOwner;
  const { data: updates, isLoading, isError, refetch } = useListMyArtistUpdates({
    query: { queryKey: getListMyArtistUpdatesQueryKey(), enabled: isArtist },
  });
  const markRead = useMarkMyArtistUpdatesRead();
  // Remember what was new when she opened the page, so the "New" marker stays
  // visible while she reads even though it is marked read straight away.
  const [newIds, setNewIds] = useState<Set<string> | null>(null);
  const marking = useRef(false);

  useEffect(() => {
    if (!updates || newIds !== null) return;
    const unread = updates.filter((u) => !u.readAt).map((u) => u.id);
    setNewIds(new Set(unread));
    if (unread.length > 0 && !marking.current) {
      marking.current = true;
      markRead.mutate(undefined, {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListMyArtistUpdatesQueryKey() }),
      });
    }
  }, [updates, newIds, markRead, queryClient]);

  if (!user) return <Redirect to="/login" />;
  if (!isArtist) return <Redirect to="/dashboard" />;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl mb-1">Updates</h1>
        <p className="text-sm text-muted-foreground">Messages from the Bonisa team, newest first.</p>
      </div>

      {isError ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" strokeWidth={1.9} />
            <p className="text-sm mb-4">Could not load your updates.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" strokeWidth={1.9} />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : !updates || updates.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-14 text-center">
            <Bell className="h-9 w-9 mx-auto mb-4 text-muted-foreground/50" strokeWidth={1.9} />
            <p className="font-medium mb-1">No updates yet</p>
            <p className="text-sm text-muted-foreground">When the Bonisa team sends you something, it will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => {
            const isNew = newIds?.has(u.id) ?? !u.readAt;
            return (
              <Card key={u.id} className={`bg-card ${isNew ? "border-primary/50" : "border-border/50"}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold leading-snug">{u.subject}</h2>
                    {isNew && <Badge className="shrink-0">New</Badge>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{u.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
