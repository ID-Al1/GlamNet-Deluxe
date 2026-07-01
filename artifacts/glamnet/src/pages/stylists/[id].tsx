import { useRoute, Link } from "wouter";
import { useGetStylist } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, BadgeCheck, MessageCircle, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StylistProfile() {
  const [, params] = useRoute("/stylists/:id");
  const stylistId = params?.id;
  
  const { data: stylist, isLoading, error } = useGetStylist(stylistId || "", {
    query: { enabled: !!stylistId, queryKey: ['stylist', stylistId] }
  });

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading profile...</div>;
  if (error || !stylist) return <div className="p-12 text-center text-destructive">Failed to load profile</div>;

  return (
    <div className="container py-8 max-w-5xl space-y-8">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-1/3 aspect-[4/5] bg-muted rounded-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-60" />
        </div>
        
        <div className="w-full md:w-2/3 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-serif font-bold tracking-tight">{stylist.name}</h1>
              {stylist.verified && <BadgeCheck className="w-6 h-6 text-primary" />}
            </div>
            <p className="text-xl text-primary font-medium">{stylist.specialty}</p>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {stylist.location}{stylist.area ? `, ${stylist.area}` : ''}</span>
            <span className="flex items-center gap-1"><Star className="w-4 h-4 text-primary" /> {stylist.rating} ({stylist.reviewCount} reviews)</span>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            {stylist.bio || "This stylist hasn't added a bio yet."}
          </p>

          <div className="flex gap-4 pt-2">
            <Link href={`/book/${stylist.id}`}>
              <Button size="lg" className="h-12 px-8">Book Now</Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 px-8 bg-transparent">
              <MessageCircle className="w-5 h-5 mr-2" /> Message
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="services" className="w-full mt-12">
        <TabsList className="mb-8 border-b rounded-none w-full justify-start h-auto p-0 bg-transparent">
          <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6 font-medium">Services & Pricing</TabsTrigger>
          <TabsTrigger value="portfolio" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6 font-medium">Portfolio</TabsTrigger>
        </TabsList>
        
        <TabsContent value="services" className="space-y-4">
          {stylist.services && stylist.services.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {stylist.services.map((service) => (
                <Card key={service.id} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-6 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" /> {service.duration} mins
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-xl font-bold">R{service.price}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
             <p className="text-muted-foreground">No services listed yet.</p>
          )}
        </TabsContent>
        
        <TabsContent value="portfolio">
          {stylist.portfolio && stylist.portfolio.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stylist.portfolio.map((item) => (
                <div key={item.id} className="aspect-square bg-muted rounded-xl relative group overflow-hidden">
                  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <h4 className="font-bold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No portfolio items added yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClockIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
