import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetStylist, useCreateAppointment } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export default function BookStylist() {
  const [, params] = useRoute("/book/:stylistId");
  const stylistId = params?.stylistId;
  const [, setLocation] = useLocation();
  
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  
  const { data: stylist, isLoading } = useGetStylist(stylistId || "", {
    query: { enabled: !!stylistId, queryKey: ['stylist', stylistId] }
  });
  
  const createAppointment = useCreateAppointment();

  if (isLoading || !stylist) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  const handleBook = async () => {
    if (!serviceId || !date || !time) {
      toast.error("Please select a service, date, and time.");
      return;
    }
    
    try {
      await createAppointment.mutateAsync({
        data: {
          stylistId: stylist.id,
          serviceId,
          date: format(date, 'yyyy-MM-dd'),
          time,
          notes: notes || undefined
        }
      });
      toast.success("Appointment booked successfully!");
      setLocation("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to book appointment.");
    }
  };

  const selectedService = stylist.services.find(s => s.id === serviceId);

  return (
    <div className="container py-8 sm:py-12 max-w-4xl space-y-8 px-4">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Book Appointment</h1>
        <p className="text-muted-foreground">with {stylist.name}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select Service</Label>
            <div className="grid gap-3">
              {stylist.services.map(s => (
                <Card 
                  key={s.id} 
                  className={`cursor-pointer transition-colors ${serviceId === s.id ? 'border-primary bg-primary/5' : 'hover:border-border/80'}`}
                  onClick={() => setServiceId(s.id)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{s.name}</h4>
                      <p className="text-sm text-muted-foreground">{s.duration} mins</p>
                    </div>
                    <div className="font-serif font-bold text-lg">R{s.price}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Additional Notes (Optional)</Label>
            <Textarea 
              placeholder="Any specific requests?" 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-24"
            />
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Select Date</Label>
            <Card className="p-3 inline-block bg-card/50">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md"
                disabled={(date) => date < new Date() || date < new Date(new Date().setHours(0,0,0,0))}
              />
            </Card>
          </div>

          {date && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Select Time</Label>
              <div className="grid grid-cols-3 gap-2">
                {TIMES.map(t => (
                  <Button
                    key={t}
                    variant={time === t ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setTime(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total</p>
          <p className="text-3xl font-serif font-bold">
            {selectedService ? `R${selectedService.price}` : "—"}
          </p>
        </div>
        <Button 
          size="lg" 
          className="h-14 px-8 text-base w-full sm:w-auto"
          disabled={!serviceId || !date || !time || createAppointment.isPending}
          onClick={handleBook}
        >
          {createAppointment.isPending ? "Confirming..." : "Confirm Booking"}
        </Button>
      </div>
    </div>
  );
}
