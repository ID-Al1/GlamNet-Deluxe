import { useState } from "react";
import { useListConversations } from "@workspace/api-client-react";

export default function Messages() {
  const { data: conversations, isLoading } = useListConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex-1 flex overflow-hidden border-t">
      {/* Sidebar */}
      <div className="w-full md:w-80 border-r bg-card/30 flex flex-col">
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
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === conv.id ? 'bg-muted/80' : ''}`}
              >
                <h4 className="font-medium truncate">{conv.participants.map(p => p.name).join(', ')}</h4>
                <p className="text-sm text-muted-foreground truncate mt-1">{conv.lastMessage || "Started a conversation"}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="hidden md:flex flex-1 flex-col bg-background/50">
        {selectedId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
             Message thread component placeholder
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
