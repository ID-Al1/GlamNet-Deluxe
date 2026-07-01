import { useState } from "react";
import { useListConversations } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Messages() {
  const { data: conversations, isLoading } = useListConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedConv = conversations?.find(c => c.id === selectedId);

  return (
    <div className="flex-1 flex overflow-hidden border-t">
      {/* Conversation list — hidden on mobile when a thread is open */}
      <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 border-r bg-card/30 flex-col`}>
        <div className="p-4 border-b">
          <h2 className="font-serif font-bold text-xl">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : conversations?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No conversations yet</div>
          ) : (
            conversations?.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === conv.id ? "bg-muted/80" : ""}`}
              >
                <h4 className="font-medium truncate">{conv.participants.map(p => p.name).join(", ")}</h4>
                <p className="text-sm text-muted-foreground truncate mt-1">{conv.lastMessage || "Started a conversation"}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread view — shown on mobile when a thread is selected */}
      <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-background/50`}>
        {/* Mobile back button */}
        {selectedId && (
          <div className="flex items-center gap-2 p-3 border-b md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {selectedConv && (
              <span className="text-sm font-medium truncate">
                {selectedConv.participants.map(p => p.name).join(", ")}
              </span>
            )}
          </div>
        )}

        {selectedId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Message thread coming soon
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
