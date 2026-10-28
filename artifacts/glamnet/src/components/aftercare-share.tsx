import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { aftercareUrl, aftercareWhatsAppLink } from "@/lib/aftercare";

/** The link to a live page, with copy and WhatsApp share. Sharing happens on the artist's own phone. */
export function AftercareShare({ token, artistName }: { token: string; artistName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = aftercareUrl(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      // Some browsers refuse clipboard access. Select the text so she can copy it by hand.
      inputRef.current?.select();
      toast.error("Could not copy automatically. The link is selected, press copy on your keyboard or phone.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input ref={inputRef} readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link to share" className="font-mono text-xs" />
        <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={copy} data-testid="aftercare-copy">
          <Copy className="h-4 w-4" strokeWidth={1.9} />Copy
        </Button>
      </div>
      <a href={aftercareWhatsAppLink(artistName, token)} target="_blank" rel="noopener noreferrer" className="block" data-testid="aftercare-whatsapp">
        <Button type="button" className="w-full gap-2"><MessageCircle className="h-4 w-4" strokeWidth={1.9} />Share on WhatsApp</Button>
      </a>
    </div>
  );
}
