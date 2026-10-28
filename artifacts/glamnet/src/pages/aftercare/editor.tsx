import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAftercarePageQueryKey, getListMyAftercareQueryKey, useGetAftercarePage, useGetMyStylistProfile,
  usePublishAftercarePage, useUnpublishAftercarePage, useUpdateAftercarePage,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AftercareShare } from "@/components/aftercare-share";
import { AftercareView } from "@/components/aftercare-view";
import { AFTERCARE_CATEGORY_LABELS, blocksToPayload, newBlock, withKey, type EditorBlock } from "@/lib/aftercare";
import { apiErrorMessage } from "@/lib/api-error";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BLOCK_LABELS = { heading: "Heading", paragraph: "Paragraph", list: "List" } as const;
const BLOCK_HELP = {
  heading: "A short title for a group of instructions",
  paragraph: "A few sentences",
  list: "One point per line",
} as const;

export default function AftercareEditor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [, params] = useRoute("/aftercare/:id");
  const pageId = params?.id ?? "";
  const isArtist = user?.role === "stylist";
  const { data: page, isLoading, isError } = useGetAftercarePage(pageId, { query: { enabled: isArtist && !!pageId, retry: false, staleTime: 0 } as any });
  const { data: profile } = useGetMyStylistProfile({ query: { enabled: isArtist } as any });

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [rebookingUrl, setRebookingUrl] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");

  useEffect(() => { if (user && !isArtist) navigate("/dashboard"); }, [user, isArtist, navigate]);
  useEffect(() => {
    if (page && page.id !== loadedId) {
      setLoadedId(page.id); setTitle(page.title); setCategory(page.category);
      setBlocks(withKey(page.blocks)); setRebookingUrl(page.rebookingUrl ?? ""); setReviewed(false);
    }
  }, [page, loadedId]);

  const payload = useMemo(() => blocksToPayload(blocks), [blocks]);
  const artistName = profile?.name ?? user?.name ?? "Your name";
  const body = { title, category: category as any, blocks: payload, rebookingUrl: rebookingUrl.trim() || null };
  // Compared by content, not by raw JSON: the database may return fields in a different order.
  const signature = (list: { type: string; text?: string; items?: string[] }[]) =>
    JSON.stringify(list.map((b) => [b.type, b.type === "list" ? b.items : b.text]));
  const dirty = !!page && (
    title !== page.title || category !== page.category || (rebookingUrl.trim() || null) !== page.rebookingUrl
    || signature(payload) !== signature(page.blocks)
  );

  const saved = (next: Parameters<typeof qc.setQueryData>[1]) => {
    qc.setQueryData(getGetAftercarePageQueryKey(pageId), next);
    qc.invalidateQueries({ queryKey: getListMyAftercareQueryKey() });
  };
  const update = useUpdateAftercarePage({ mutation: { onError: (e) => toast.error(apiErrorMessage(e)) } });
  const publish = usePublishAftercarePage({ mutation: { onError: (e) => toast.error(apiErrorMessage(e)) } });
  const unpublish = useUnpublishAftercarePage({ mutation: { onError: (e) => toast.error(apiErrorMessage(e)) } });
  const busy = update.isPending || publish.isPending || unpublish.isPending;

  const saveDraft = async () => {
    const result = await update.mutateAsync({ pageId, data: body }).catch(() => null);
    if (result) { saved(result); toast.success("Saved."); }
  };
  const publishNow = async () => {
    const result = await update.mutateAsync({ pageId, data: body }).catch(() => null);
    if (!result) return;
    const live = await publish.mutateAsync({ pageId, data: { reviewed: true } }).catch(() => null);
    if (live) { saved(live); setReviewed(false); toast.success("Published. Share the link with your client."); }
  };
  const saveLive = async () => {
    const result = await update.mutateAsync({ pageId, data: { ...body, reviewed: true } }).catch(() => null);
    if (result) { saved(result); setReviewed(false); toast.success("Changes saved. Your page is updated."); }
  };
  const takeDown = async () => {
    const result = await unpublish.mutateAsync({ pageId }).catch(() => null);
    if (result) { saved(result); toast.success("Taken down. The link no longer opens."); }
  };

  const setBlock = (key: string, patch: Partial<EditorBlock>) => setBlocks((all) => all.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const move = (index: number, by: -1 | 1) => setBlocks((all) => {
    const next = [...all]; const target = index + by;
    if (target < 0 || target >= next.length) return all;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  if (!isArtist) return null;
  if (isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="font-serif text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href="/aftercare" className="mt-4 inline-block text-primary underline">Back to your pages</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Link href="/aftercare" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your aftercare pages
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold">Edit page</h1>
          {page && (page.published
            ? <Badge className="border-green-500/30 bg-green-500/15 text-green-700 hover:bg-green-500/20">Live</Badge>
            : <Badge variant="outline">Draft</Badge>)}
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {page && (
        <>
          <div className="flex gap-2" role="tablist" aria-label="Edit or preview">
            <Button type="button" role="tab" aria-selected={view === "edit"} variant={view === "edit" ? "default" : "outline"} size="sm" onClick={() => setView("edit")}>Edit</Button>
            <Button type="button" role="tab" aria-selected={view === "preview"} variant={view === "preview" ? "default" : "outline"} size="sm" onClick={() => setView("preview")} data-testid="aftercare-preview-tab">Preview</Button>
          </div>

          {view === "preview" ? (
            <div data-testid="aftercare-preview">
              <AftercareView title={title} artistName={artistName} blocks={payload} rebookingUrl={rebookingUrl.trim() || null} artistProfileId={profile?.id ?? null} />
              <p className="mt-3 text-center text-xs text-muted-foreground">This is what your client will see.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="bg-card"><CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="aftercare-title">Title</Label>
                  <Input id="aftercare-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Braids aftercare" data-testid="aftercare-title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aftercare-category">Service</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="aftercare-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AFTERCARE_CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent></Card>

              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <Card key={block.key} className="bg-card" data-testid={`aftercare-block-${index}`}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{BLOCK_LABELS[block.type]}</p>
                          <p className="text-xs text-muted-foreground">{BLOCK_HELP[block.type]}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" size="icon" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" strokeWidth={1.9} /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label="Move down" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" strokeWidth={1.9} /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label="Remove" className="text-destructive" onClick={() => setBlocks((all) => all.filter((b) => b.key !== block.key))}><Trash2 className="h-4 w-4" strokeWidth={1.9} /></Button>
                        </div>
                      </div>
                      {block.type === "heading" ? (
                        <Input value={block.text ?? ""} maxLength={120} onChange={(e) => setBlock(block.key, { text: e.target.value })} aria-label="Heading" />
                      ) : (
                        <Textarea value={block.text ?? ""} rows={block.type === "list" ? 5 : 4} maxLength={block.type === "list" ? 9000 : 2000}
                          onChange={(e) => setBlock(block.key, { text: e.target.value })} aria-label={BLOCK_LABELS[block.type]} />
                      )}
                    </CardContent>
                  </Card>
                ))}
                <div className="flex flex-wrap gap-2">
                  {(["heading", "paragraph", "list"] as const).map((type) => (
                    <Button key={type} type="button" variant="outline" size="sm" onClick={() => setBlocks((all) => [...all, newBlock(type)])} data-testid={`aftercare-add-${type}`}>Add {BLOCK_LABELS[type].toLowerCase()}</Button>
                  ))}
                </div>
              </div>

              <Card className="bg-card"><CardContent className="space-y-2 p-5">
                <Label htmlFor="aftercare-rebook">Booking link (optional)</Label>
                <Input id="aftercare-rebook" value={rebookingUrl} onChange={(e) => setRebookingUrl(e.target.value)} placeholder="https://" inputMode="url" data-testid="aftercare-rebook" />
                <p className="text-xs text-muted-foreground">Where your client goes to book again. Leave it empty to send them to your Bonisa profile.</p>
              </CardContent></Card>
            </div>
          )}

          <Card className="border-primary/20 bg-card"><CardContent className="space-y-4 p-5">
            {page.published && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your link</p>
                <AftercareShare token={page.publicToken} artistName={artistName} />
              </div>
            )}
            <div className="flex items-start gap-3">
              <Checkbox id="aftercare-reviewed" checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} className="mt-0.5" data-testid="aftercare-reviewed" />
              <Label htmlFor="aftercare-reviewed" className="text-sm font-normal leading-snug">
                I have read these instructions and I am happy for my clients to follow them. This is general guidance from me, not medical advice.
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {page.published ? (
                <>
                  <Button disabled={busy || !reviewed || !dirty} onClick={saveLive} data-testid="aftercare-save-live">Save changes</Button>
                  <Button variant="outline" disabled={busy} onClick={takeDown} data-testid="aftercare-unpublish">Take down</Button>
                </>
              ) : (
                <>
                  <Button disabled={busy || !reviewed || payload.length === 0 || !title.trim()} onClick={publishNow} data-testid="aftercare-publish">Publish</Button>
                  <Button variant="outline" disabled={busy || !dirty} onClick={saveDraft} data-testid="aftercare-save-draft">Save draft</Button>
                </>
              )}
            </div>
            {dirty && <p className="text-xs text-muted-foreground">You have changes that are not saved yet.</p>}
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
