import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API = `${import.meta.env.BASE_URL}api`;

/**
 * Shows a photo. Public photos load directly. Private ones (the model's own, or an
 * owner reviewing) need the bearer token, which an <img> tag cannot send, so they
 * are fetched with it and shown from a short-lived in-memory blob. Nothing is cached.
 */
export function AuthedImage({ path, alt, className = "" }: { path: string; alt: string; className?: string }) {
  const { token } = useAuth();
  const isProtected = path.startsWith("/models/") || path.startsWith("/owner/");
  const [src, setSrc] = useState<string | null>(isProtected ? null : `${API}${path}`);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isProtected) { setSrc(`${API}${path}`); setFailed(false); return; }
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("failed"))))
      .then((b) => { if (!cancelled) { url = URL.createObjectURL(b); setSrc(url); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [path, token, isProtected]);

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground text-xs ${className}`}>
        <ImageOff className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
        Photo unavailable
      </div>
    );
  }
  if (!src) return <div className={`animate-pulse bg-muted ${className}`} aria-label="Loading photo" />;
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}
