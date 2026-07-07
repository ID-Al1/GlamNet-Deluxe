import { useState, useEffect, useRef } from "react";
import { useListConversations } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { Link } from "wouter";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/messages/conversations/${conversationId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function sendMessage(conversationId: string, content: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/messages/conversations/${conversationId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to send");
  return res.json();
}

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: conversations, isLoading } = useListConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select conversation from URL params — runs only once when conversations first loads.
  // Guard prevents re-firing on every background refetch (new array reference from react-query).
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || !conversations?.length) return;
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

  const selectedConv = conversations?.find(c => c.id === selectedId);

  const { data: messagesData } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => fetchMessages(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 4000,
  });
  // Stable empty array so the scroll effect doesn't fire on every render when there are no messages
  const messages = messagesData ?? [];

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(selectedId!, content),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      inputRef.current?.focus();
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sendMutation.isPending) return;
    sendMutation.mutate(content);
  };

  const otherParticipant = (conv: NonNullable<typeof selectedConv>) =>
    conv.participants.find(p => p.id !== user?.id) ?? conv.participants[0];

  return (
    <div className="flex-1 flex overflow-hidden border-t" style={{ height: "calc(100dvh - 64px)" }}>
      {/* Sidebar — conversation list */}
      <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 border-r bg-card/30 flex-col shrink-0`}>
        <div className="p-4 border-b">
          <h2 className="font-serif font-bold text-xl">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[0, 1, 2].map(i => (
                <div key={i} className="p-4 border-b animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : !conversations?.length ? (
            <div className="p-8 text-center text-muted-foreground space-y-3">
              <MessageCircle className="h-8 w-8 mx-auto opacity-30" />
              <div>
                <p className="font-medium text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Book a service to start chatting with an artist.</p>
              </div>
              <Link href="/stylists">
                <Button size="sm" variant="outline" className="mt-2">Find an artist</Button>
              </Link>
            </div>
          ) : (
            conversations.map(conv => {
              const other = otherParticipant(conv);
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === conv.id ? "bg-muted/80 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">{other?.name ?? "Conversation"}</h4>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage || "No messages yet — say hello!"}
                  </p>
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
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/30 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="md:hidden shrink-0 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-sm font-serif font-bold text-primary">
                  {otherParticipant(selectedConv)?.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {otherParticipant(selectedConv)?.name ?? "Artist"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {otherParticipant(selectedConv)?.role ?? ""}
                </p>
              </div>
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
                messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
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
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-2 mt-0.5">
                        {new Date(msg.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Compose bar */}
            <form onSubmit={handleSend} className="px-4 py-3 border-t bg-card/30 flex gap-2 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={`Message ${otherParticipant(selectedConv)?.name ?? ""}…`}
                className="flex-1 px-4 py-2.5 rounded-full border border-border/60 bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim() || sendMutation.isPending}
                className="rounded-full shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
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
