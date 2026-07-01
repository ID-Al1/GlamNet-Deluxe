import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative w-full h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background gradient/overlay */}
        <div className="absolute inset-0 bg-background/80 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
        
        <div className="container relative z-20 flex flex-col items-center text-center space-y-8 max-w-4xl px-4">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight">
            Where Beauty <br />
            <span className="text-primary italic">Meets Opportunity</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            The definitive platform for South Africa's beauty industry. Connect with top makeup artists, hair stylists, and estheticians for your next booking or campaign.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/stylists">
              <Button size="lg" className="h-14 px-8 text-base">Find a Stylist</Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base bg-card hover:bg-card/80">Join as a Professional</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-serif font-bold">Featured Talent</h2>
              <p className="text-muted-foreground text-lg">Discover handpicked artists leading the industry across South Africa.</p>
            </div>
            <Link href="/stylists">
              <Button variant="ghost" className="text-primary">View all talent &rarr;</Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Placeholder for featured stylists */}
            {[1, 2, 3].map(i => (
              <div key={i} className="group relative rounded-xl overflow-hidden bg-background border border-border transition-all hover:border-primary/50">
                <div className="aspect-[4/5] bg-muted w-full relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent z-10" />
                  <div className="absolute bottom-4 left-4 z-20">
                    <h3 className="text-xl font-serif font-bold mb-1">Artist Name</h3>
                    <p className="text-sm text-primary">Makeup & Hair</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
