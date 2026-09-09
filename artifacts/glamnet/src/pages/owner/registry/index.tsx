import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useSearchOwnerRegistry } from "@workspace/api-client-react";
import type { OwnerRegistryEntry } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Mail, Phone, Building2, User, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function OwnerRegistry() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: results, isLoading, error } = useSearchOwnerRegistry({ q: debouncedQuery || undefined });

  const artists = results?.filter((r) => r.role === "stylist") || [];
  const clients = results?.filter((r) => r.role === "client") || [];
  const brands = results?.filter((r) => r.role === "brand") || [];

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive" strokeWidth={1.9} />
        <div>
          <h2 className="text-xl font-serif mb-1">Failed to load registry</h2>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const renderSection = (title: string, entries: OwnerRegistryEntry[]) => {
    if (entries.length === 0) return null;
    return (
      <div className="space-y-4 mb-8">
        <h2 className="font-serif text-xl border-b border-border/50 pb-2 flex items-center">
          {title} 
          <span className="text-muted-foreground text-sm font-sans font-normal ml-2">({entries.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <Link 
              key={entry.userId} 
              href={`/owner/registry/${entry.userId}`}
              className="block group"
              data-testid={`card-registry-entry-${entry.userId}`}
            >
              <Card className="bg-card border-border/50 h-full transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{entry.name}</h3>
                      {entry.verificationStatus === "verified" && (
                        <Badge variant="secondary" className="shrink-0">Verified</Badge>
                      )}
                      {entry.verificationStatus === "pending" && (
                        <Badge variant="outline" className="shrink-0">Pending</Badge>
                      )}
                    </div>
                    
                    {entry.businessName && (
                      <p className="text-sm flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                        <span className="truncate">{entry.businessName}</span>
                      </p>
                    )}
                    
                    {entry.specialty && (
                      <p className="text-sm text-muted-foreground mb-3 truncate">
                        {entry.specialty}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                      <span className="truncate">{entry.email}</span>
                    </p>
                    {entry.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                        <span>{entry.phone}</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2">
                      <span className="text-[10px] uppercase tracking-wider">Joined {format(new Date(entry.joinedAt), "MMM yyyy")}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" strokeWidth={1.9} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl mb-2">User Registry</h1>
        <p className="text-sm text-muted-foreground">Search and review all users on the platform.</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.9} />
        <Input 
          type="text"
          placeholder="Search by name, email, phone, or specialty..."
          className="pl-10 h-12 text-base bg-card border-border/50 focus-visible:ring-primary/20"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-registry-search"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          <Skeleton className="h-48 rounded-xl bg-card border-border/50" />
          <Skeleton className="h-48 rounded-xl bg-card border-border/50" />
          <Skeleton className="h-48 rounded-xl bg-card border-border/50" />
        </div>
      ) : results?.length === 0 ? (
        <div className="py-16 text-center">
          <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.9} />
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="pt-4">
          {renderSection("Artists", artists)}
          {renderSection("Brands", brands)}
          {renderSection("Clients", clients)}
        </div>
      )}
    </div>
  );
}
