import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMyAftercareQueryKey, useCreateAftercarePage, useDeleteAftercarePage, useDuplicateAftercarePage,
  useListAftercareTemplates, useListMyAftercare, useGetMyStylistProfile, useUnpublishAftercarePage,
} from "@workspace/api-client-react";
import type { AftercarePage } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AftercareShare } from "@/components/aftercare-share";
import { AFTERCARE_CATEGORY_LABELS } from "@/lib/aftercare";
import { apiErrorMessage } from "@/lib/api-error";
import { ArrowLeft, ClipboardList, Copy, Eye, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AftercareManager() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isArtist = user?.role === "stylist";
  const { data, isLoading } = useListMyAftercare({ query: { enabled: isArtist } as any });
  const { data: templates } = useListAftercareTemplates({ query: { enabled: isArtist && !!data?.verified } as any });
  const { data: profile } = useGetMyStylistProfile({ query: { enabled: isArtist } as any });
  const [pickOpen, setPickOpen] = useState(false);
  const [deleting, setDeleting] = useState<AftercarePage | null>(null);
  const [sharing, setSharing] = useState<AftercarePage | null>(null);

  useEffect(() => { if (user && !isArtist) navigate("/dashboard"); }, [user, isArtist, navigate]);
  const refresh = () => qc.invalidateQueries({ queryKey: getListMyAftercareQueryKey() });

  const create = useCreateAftercarePage({
    mutation: {
      onSuccess: (page) => { setPickOpen(false); refresh(); navigate(`/aftercare/${page.id}`); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });
  const duplicate = useDuplicateAftercarePage({
    mutation: { onSuccess: (page) => { toast.success("Copied. Check it, then publish it for your next client."); refresh(); navigate(`/aftercare/${page.id}`); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  });
  const unpublish = useUnpublishAftercarePage({
    mutation: { onSuccess: () => { toast.success("Taken down. The link no longer opens."); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  });
  const remove = useDeleteAftercarePage({
    mutation: { onSuccess: () => { setDeleting(null); toast.success("Deleted."); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  });

  if (!isArtist) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold">Aftercare</h1>
            <p className="mt-1 text-sm text-muted-foreground">Send your clients clear instructions after their appointment. They open a link on their phone. No sign up needed.</p>
          </div>
          {data?.verified && (
            <Button className="gap-2" onClick={() => setPickOpen(true)} data-testid="aftercare-new"><Plus className="h-4 w-4" strokeWidth={1.9} />New page</Button>
          )}
        </div>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      {data && !data.verified && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.9} aria-hidden="true" />
            <div>
              <p className="font-medium">Aftercare is for verified artists.</p>
              <p className="mt-1 text-muted-foreground">Finish your verification and you can create and share pages. <Link href="/profile" className="text-primary underline">Go to your profile</Link></p>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.verified && data.pages.length === 0 && (
        <Card className="bg-card">
          <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            You have no aftercare pages yet. Tap New page, pick your service, and edit the starting text into your own words.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.pages.map((page) => (
          <Card key={page.id} className="bg-card" data-testid={`aftercare-row-${page.id}`}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{page.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {AFTERCARE_CATEGORY_LABELS[page.category] ?? page.category}
                    {page.published && (
                      <> · Opened {page.viewCount} {page.viewCount === 1 ? "time" : "times"}{page.lastViewedAt ? `, last on ${format(new Date(page.lastViewedAt), "d MMM")}` : ""}</>
                    )}
                  </p>
                </div>
                {page.published
                  ? <Badge className="shrink-0 border-green-500/30 bg-green-500/15 text-green-700 hover:bg-green-500/20">Live</Badge>
                  : <Badge variant="outline" className="shrink-0">Draft</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/aftercare/${page.id}`}><Button size="sm" variant="outline" className="gap-1.5"><Pencil className="h-3.5 w-3.5" strokeWidth={1.9} />Edit</Button></Link>
                {page.published && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSharing(page)}><Copy className="h-3.5 w-3.5" strokeWidth={1.9} />Share</Button>}
                {page.published && <Button size="sm" variant="outline" className="gap-1.5" disabled={unpublish.isPending} onClick={() => unpublish.mutate({ pageId: page.id })}><Eye className="h-3.5 w-3.5" strokeWidth={1.9} />Take down</Button>}
                {data.verified && <Button size="sm" variant="outline" disabled={duplicate.isPending} onClick={() => duplicate.mutate({ pageId: page.id })}>Make a copy</Button>}
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleting(page)}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What service is this for?</DialogTitle>
            <DialogDescription>You get starting text to change into your own words. You are responsible for what your page says, so read it before you publish.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(templates ?? []).map((t) => (
              <Button key={t.category} variant="outline" className="h-12 justify-start" disabled={create.isPending} data-testid={`aftercare-template-${t.category}`}
                onClick={() => create.mutate({ data: { title: t.title, category: t.category, blocks: t.blocks, rebookingUrl: null } })}>
                {AFTERCARE_CATEGORY_LABELS[t.category]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sharing} onOpenChange={(open) => !open && setSharing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share this page</DialogTitle><DialogDescription>Send the link to your client. Anyone with the link can open it.</DialogDescription></DialogHeader>
          {sharing && <AftercareShare token={sharing.publicToken} artistName={profile?.name ?? user?.name ?? "your artist"} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this page?</DialogTitle>
            <DialogDescription>"{deleting?.title}" will be deleted and its link will stop working. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate({ pageId: deleting.id })} data-testid="aftercare-confirm-delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
