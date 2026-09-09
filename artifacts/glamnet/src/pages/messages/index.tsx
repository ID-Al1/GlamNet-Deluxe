import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MessageCircle, Image, Mic, Square, Play, Pause, Check, CheckCheck, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  content: string;
  messageType: string;
  mediaUrl?: string | null;
  createdAt: string;
};

type ConversationType = {
  id: string;
  participants: Array<{ id: string; name: string; role: string; avatarUrl?: string | null }>;
  lastMessage?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isOtherTyping?: boolean;
  clientLastReadAt?: string | null;
  stylistLastReadAt?: string | null;
};

const BASE = import.meta.env.BASE_URL;

/**
 * Authenticated fetch wrapper — reads the stored bearer token from localStorage
 * (same key used by AuthProvider) and attaches Authorization: Bearer <token>.
 * This is necessary because all API routes require a bearer token; there is no
 * cookie-based session on this backend.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const stored = localStorage.getItem("glamnet_auth");
    const token: string | null = stored ? (JSON.parse(stored) as { token?: string }).token ?? null : null;
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    return fetch(url, options);
  }
}
async function fetchConversations(): Promise<ConversationType[]> {
  const res = await authFetch(`${BASE}api/messages/conversations`);
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await authFetch(`${BASE}api/messages/conversations/${conversationId}`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function sendMessage(conversationId: string, payload: { content: string; messageType?: string; mediaUrl?: string }): Promise<Message> {
  const res = await authFetch(`${BASE}api/messages/conversations/${conversationId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to send");
  return res.json();
}

async function signalTyping(conversationId: string): Promise<void> {
  await authFetch(`${BASE}api/messages/conversations/${conversationId}/typing`, { method: "POST" });
}

async function markRead(conversationId: string): Promise<void> {
  await authFetch(`${BASE}api/messages/conversations/${conversationId}/read`, { method: "POST" });
}

async function requestUploadUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await authFetch(`${BASE}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) throw new Error("Upload URL request failed");
  return res.json();
}

async function uploadToGcs(uploadURL: string, file: File): Promise<void> {
  // Direct GCS upload — no auth header (signed URL is self-authorizing)
  const res = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("Upload to GCS failed");
}

function VoicePlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={playing ? "Pause voice note" : "Play voice note"}
      aria-pressed={playing}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/10 hover:bg-black/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
    >
      {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
      <span className="text-xs font-medium">Voice note</span>
    </button>
  );
}

/**
 * SSE hook — connects to /api/messages/sse using a short-lived ticket so
 * the long-lived bearer token never appears in a URL or access log.
 *
 * Handshake:
 *  1. POST /api/messages/sse-ticket  (with Authorization: Bearer)  → { ticket }
 *  2. EventSource /api/messages/sse?ticket=<ticket>
 *     Ticket is single-use and expires in 30 s on the server.
 */
function useChatSSE(token: string | null) {
  const qc = useQueryClient();
  // Track per-conversation typing timers so we can clear isOtherTyping
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // Bounded exponential backoff: 1s → 2s → 4s … capped at 30s
    let retryDelayMs = 1_000;
    const MAX_RETRY_DELAY_MS = 30_000;

    const handleEvent = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: "ping" }
          | { type: "message"; conversationId: string; message: Message }
          | { type: "conversation"; conversation: Partial<ConversationType> & { id: string; typingUntil?: string } };

        if (event.type === "ping") return;

        if (event.type === "message") {
          const { conversationId } = event;
          // Invalidate rather than setQueryData — avoids a race where an
          // in-flight initial fetch resolves after the SSE event and overwrites it.
          qc.invalidateQueries({ queryKey: ["messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        }

        if (event.type === "conversation") {
          const patch = event.conversation;

          if (patch.isOtherTyping && patch.typingUntil) {
            // Apply typing indicator then auto-clear after server-set expiry
            qc.setQueryData<ConversationType[]>(["conversations"], (old) =>
              old?.map(c => c.id === patch.id ? { ...c, isOtherTyping: true } : c) ?? old,
            );
            const existing = typingTimersRef.current.get(patch.id);
            if (existing) clearTimeout(existing);
            const delay = Math.max(0, new Date(patch.typingUntil).getTime() - Date.now());
            const timer = setTimeout(() => {
              qc.setQueryData<ConversationType[]>(["conversations"], (old) =>
                old?.map(c => c.id === patch.id ? { ...c, isOtherTyping: false } : c) ?? old,
              );
              typingTimersRef.current.delete(patch.id);
            }, delay);
            typingTimersRef.current.set(patch.id, timer);
          } else {
            // Merge other patches (read receipts, unread counts, etc.)
            qc.setQueryData<ConversationType[]>(["conversations"], (old) =>
              old?.map(c => c.id === patch.id ? { ...c, ...patch } : c) ?? old,
            );
          }
        }
      } catch {
        // Malformed event — ignore
      }
    };

    /**
     * Full connection lifecycle:
     *  1. POST /sse-ticket with Authorization header → short-lived, single-use ticket
     *  2. Open EventSource with ?ticket= (bearer token never in URL/logs)
     *  3. On any error/close, intercept BEFORE EventSource can auto-reconnect
     *     (auto-reconnect would reuse the now-consumed ticket URL and always get 401).
     *     Instead, close immediately and schedule a fresh connect() with backoff.
     */
    const connect = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`${BASE}api/messages/sse-ticket`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!r.ok) throw new Error("Ticket request failed");
        const { ticket } = await r.json() as { ticket: string };
        if (cancelled) return;

        const url = `${BASE}api/messages/sse?ticket=${encodeURIComponent(ticket)}`;
        const newEs = new EventSource(url);
        es = newEs;

        newEs.addEventListener("chat", handleEvent);

        // Reset backoff on a successful open
        newEs.addEventListener("open", () => { retryDelayMs = 1_000; });

        // Intercept EventSource's built-in reconnect: we must close it ourselves
        // and restart the entire handshake (new ticket) rather than reuse the URL.
        newEs.onerror = () => {
          newEs.close(); // prevents EventSource from auto-reconnecting with stale ticket URL
          es = null;
          if (!cancelled) {
            retryTimer = setTimeout(connect, retryDelayMs);
            retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
          }
        };
      } catch {
        // Network or ticket error — back off and retry
        if (!cancelled) {
          retryTimer = setTimeout(connect, retryDelayMs);
          retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.removeEventListener("chat", handleEvent);
      es?.close();
      es = null;
      // Clear all typing timers
      for (const timer of typingTimersRef.current.values()) clearTimeout(timer);
      typingTimersRef.current.clear();
    };
  }, [token, qc]);
}
export default function Messages() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  // Connect to SSE — replaces per-conversation and list polling
  useChatSSE(token);

  // Conversations — slow fallback poll (60s) for resilience; SSE handles instant updates
  const { data: rawConversations, isLoading } = useQuery<ConversationType[]>({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    refetchInterval: 60_000,
  });
  const conversations = rawConversations ?? [];

  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || !conversations.length) return;
    autoSelectedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const convParam = params.get("conversation");
    const stylistParam = params.get("stylistId");
    const clientParam = params.get("clientId");

    if (convParam) {
      setSelectedId(convParam);
    } else if (stylistParam) {
      const match = conversations.find(c =>
        c.participants.some(p => p.id === stylistParam && p.role === "stylist")
      );
      if (match) setSelectedId(match.id);
    } else if (clientParam) {
      const match = conversations.find(c =>
        c.participants.some(p => p.id === clientParam && p.role === "client")
      );
      if (match) setSelectedId(match.id);
    }
  }, [conversations]);

  const selectedConv = conversations.find(c => c.id === selectedId);

  // Messages — SSE keeps this fresh; 30s staleTime means window-focus
  // refetches catch any edge cases (reconnects, missed events, etc.)
  const prevMessageCountRef = useRef(0);
  const { data: messagesData } = useQuery<Message[]>({
    queryKey: ["messages", selectedId],
    queryFn: () => fetchMessages(selectedId!),
    enabled: !!selectedId,
    staleTime: 30_000,
  });
  const messages = messagesData ?? [];

  // Mark read when conversation is first opened or when new messages arrive while viewing
  useEffect(() => {
    if (!selectedId) return;
    const count = messages.length;
    if (count !== prevMessageCountRef.current) {
      prevMessageCountRef.current = count;
      markRead(selectedId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  }, [selectedId, messages.length, qc]);

  // Also mark read immediately when switching to a conversation
  useEffect(() => {
    if (!selectedId) return;
    prevMessageCountRef.current = 0;
    markRead(selectedId).catch(() => {});
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [selectedId, qc]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (payload: { content: string; messageType?: string; mediaUrl?: string }) =>
      sendMessage(selectedId!, payload),
    onSuccess: () => {
      setDraft("");
      // Invalidate rather than setQueryData so the authoritative server list
      // is always what's shown — SSE also triggers an invalidation on both sides.
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      inputRef.current?.focus();
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sendMutation.isPending) return;
    sendMutation.mutate({ content, messageType: "text" });
  };

  const handleTyping = useCallback(() => {
    if (!selectedId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    signalTyping(selectedId).catch(() => {});
    typingTimerRef.current = setTimeout(() => {}, 3000);
  }, [selectedId]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    e.target.value = "";

    setIsUploadingMedia(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl(file);
      await uploadToGcs(uploadURL, file);
      const mediaUrl = `${BASE}api/storage${objectPath}`;
      sendMutation.mutate({ content: "Image", messageType: "image", mediaUrl });
    } catch {
      // silently fail — user can retry
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setIsUploadingMedia(true);
        try {
          const { uploadURL, objectPath } = await requestUploadUrl(file);
          await uploadToGcs(uploadURL, file);
          const mediaUrl = `${BASE}api/storage${objectPath}`;
          sendMutation.mutate({ content: "Voice note", messageType: "voice", mediaUrl });
        } catch {
          // silently fail
        } finally {
          setIsUploadingMedia(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      // mic permission denied or unavailable
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const otherParticipant = (conv: ConversationType) =>
    conv.participants.find(p => p.id !== user?.id) ?? conv.participants[0];

  const getReadReceipt = (msg: Message): "none" | "sent" | "read" => {
    if (!selectedConv || msg.senderId !== user?.id) return "none";
    const readAt = user?.role === "stylist"
      ? selectedConv.clientLastReadAt
      : selectedConv.stylistLastReadAt;
    if (!readAt) return "sent";
    return new Date(readAt) >= new Date(msg.createdAt) ? "read" : "sent";
  };

  return (
    <div className="flex-1 flex overflow-hidden border-t" style={{ height: "calc(100dvh - 64px)" }}>
      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload image"
        onChange={handleImageSelect}
      />

      {/* Sidebar — conversation list */}
      <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 border-r bg-card flex-col shrink-0`}>
        <div className="px-5 py-4 border-b">
          <p className="text-accent text-[10px] font-semibold uppercase tracking-widest mb-0.5">Inbox</p>
          <h2 className="font-serif font-bold text-xl">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[0, 1, 2].map(i => (
                <div key={i} className="p-4 border-b animate-pulse flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !conversations.length ? (
            <div className="p-8 text-center text-muted-foreground space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">No conversations yet</p>
                <p className="text-xs mt-1 leading-relaxed">Book a service to start chatting with an artist.</p>
              </div>
              <Link href="/stylists">
                <Button size="sm" variant="outline" className="rounded-full px-4 mt-1">Find an artist</Button>
              </Link>
            </div>
          ) : (
            conversations.map(conv => {
              const other = otherParticipant(conv);
              const isSelected = selectedId === conv.id;
              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Conversation with ${other?.name ?? "Unknown"}`}
                  onClick={() => setSelectedId(conv.id)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(conv.id); } }}
                  className={`px-4 py-3.5 border-b cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 ${
                    isSelected
                      ? "bg-primary/8 border-l-2 border-l-primary"
                      : "hover:bg-muted/50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-serif font-bold"
                      style={{
                        background: isSelected ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                        color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {other?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={`text-sm truncate ${isSelected ? "font-bold" : "font-semibold"}`}>
                          {other?.name ?? "Conversation"}
                        </h4>
                        {conv.unreadCount > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: 'hsl(var(--orange))', color: 'white' }}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.isOtherTyping ? (
                          <span className="italic" style={{ color: 'hsl(var(--baby-blue))' }}>typing…</span>
                        ) : (
                          conv.lastMessage || "No messages yet — say hello!"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Thread view */}
      <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {selectedId && selectedConv ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} aria-label="Back to conversations" className="md:hidden shrink-0 h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                <span className="text-sm font-serif font-bold text-primary">
                  {otherParticipant(selectedConv)?.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">
                  {otherParticipant(selectedConv)?.name ?? "Artist"}
                </p>
                <p className="text-xs capitalize">
                  {selectedConv.isOtherTyping ? (
                    <span className="italic" style={{ color: 'hsl(var(--baby-blue))' }}>typing…</span>
                  ) : (
                    <span style={{ color: 'hsl(var(--baby-blue))' }}>{otherParticipant(selectedConv)?.role ?? ""}</span>
                  )}
                </p>
              </div>
              {otherParticipant(selectedConv)?.id && (
                <Link href={`/complaints/new?subjectUserId=${encodeURIComponent(otherParticipant(selectedConv)!.id)}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 px-3"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.9} />
                    <span className="text-[11px] font-semibold hidden md:inline">Report</span>
                  </Button>
                </Link>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 opacity-30" />
                  <div>
                    <p className="font-medium text-sm">No messages yet</p>
                    <p className="text-xs mt-1">
                      Say hello to {otherParticipant(selectedConv)?.name ?? "your artist"}!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  const isSystem = msg.messageType === "system";
                  const receipt = getReadReceipt(msg);
                  const isLastMine = isMe && messages.slice(idx + 1).every(m => m.senderId !== user?.id || m.messageType === "system");

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/40">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <span className="text-[11px] text-muted-foreground px-2 mb-0.5">{msg.senderName}</span>
                      )}
                      <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/60 rounded-bl-sm"
                      }`}>
                        {msg.messageType === "image" && msg.mediaUrl ? (
                          <img
                            src={msg.mediaUrl}
                            alt="Shared image"
                            className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                            onClick={() => window.open(msg.mediaUrl!, "_blank")}
                          />
                        ) : msg.messageType === "voice" && msg.mediaUrl ? (
                          <VoicePlayer src={msg.mediaUrl} />
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className={`flex items-center gap-1 px-2 mt-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isMe && isLastMine && (
                          receipt === "read"
                            ? <CheckCheck className="h-3 w-3 text-primary" />
                            : <Check className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {selectedConv.isOtherTyping && (
                <div className="flex items-start gap-2">
                  <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Compose bar */}
            <form onSubmit={handleSend} className="px-4 py-3 border-t bg-card/30 flex gap-2 items-center shrink-0">
              {/* Image upload button */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploadingMedia || sendMutation.isPending || isRecording}
                aria-label="Attach image"
              >
                <Image className="h-4 w-4" aria-hidden="true" />
              </Button>

              {/* Voice note button */}
              <Button
                type="button"
                size="icon"
                variant={isRecording ? "destructive" : "ghost"}
                className="shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploadingMedia || sendMutation.isPending}
                aria-label={isRecording ? "Stop recording" : "Record voice note"}
                aria-pressed={isRecording}
              >
                {isRecording ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              </Button>

              <label htmlFor="message-compose" className="sr-only">
                Message {otherParticipant(selectedConv)?.name ?? ""}
              </label>
              <input
                id="message-compose"
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => { setDraft(e.target.value); handleTyping(); }}
                placeholder={
                  isUploadingMedia ? "Uploading…" :
                  isRecording ? "Recording… tap ■ to send" :
                  `Message ${otherParticipant(selectedConv)?.name ?? ""}…`
                }
                disabled={isRecording || isUploadingMedia}
                autoComplete="off"
                className="flex-1 px-4 py-2.5 rounded-full border border-border/60 bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 min-w-0 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim() || sendMutation.isPending || isRecording || isUploadingMedia}
                className="rounded-full shrink-0 h-10 w-10"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3 p-8">
            <MessageCircle className="h-10 w-10 opacity-20" />
            <div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose from your conversations to start chatting.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
