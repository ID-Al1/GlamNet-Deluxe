import { useEffect } from "react";
import { useRoute } from "wouter";
import { useGetPublicAftercare } from "@workspace/api-client-react";
import { AftercareView } from "@/components/aftercare-view";
import { Skeleton } from "@/components/ui/skeleton";

/** The open aftercare page. No login, no Bonisa menu, and kept out of search engines. */
export default function PublicAftercare() {
  const [, params] = useRoute("/a/:token");
  const token = params?.token ?? "";
  const { data, isLoading, isError } = useGetPublicAftercare(token, { query: { retry: false, staleTime: 0 } as any });

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const previous = document.title;
    return () => { meta.remove(); document.title = previous; };
  }, []);
  useEffect(() => { if (data?.title) document.title = `${data.title} | ${data.artist.name}`; }, [data]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:py-10">
      {isLoading && (
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}
      {isError && (
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="font-serif text-2xl font-bold">This page is not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may be wrong, or your artist has taken it down. Please ask her for a new link.
          </p>
        </div>
      )}
      {data && (
        <AftercareView
          title={data.title} artistName={data.artist.name} blocks={data.blocks}
          rebookingUrl={data.rebookingUrl} artistProfileId={data.artist.profileId}
        />
      )}
      {data && <p className="mt-6 text-center text-xs text-muted-foreground">Aftercare on Bonisa</p>}
    </main>
  );
}
