import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMySafetyContactQueryKey, useGetMySafetyContact, useSaveMySafetyContact } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";

/** The artist's trusted contact. Private to her; Bonisa never contacts this person. */
export function SafetyContactCard() {
  const qc = useQueryClient();
  const { data } = useGetMySafetyContact();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (data) { setName(data.name ?? ""); setPhone(data.phone ?? ""); }
  }, [data?.name, data?.phone]);

  const save = useSaveMySafetyContact({
    mutation: {
      onSuccess: (saved) => {
        toast.success(saved.name ? "Trusted contact saved." : "Trusted contact removed.");
        qc.invalidateQueries({ queryKey: getGetMySafetyContactQueryKey() });
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });

  const saved = !!(data?.name && data?.phone);
  const changed = name.trim() !== (data?.name ?? "") || phone.trim() !== (data?.phone ?? "");

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif font-bold flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" strokeWidth={1.9} aria-hidden="true" />
        Your safety
      </h2>
      <Card className="border-border/50 bg-card">
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose someone you trust. At each booking you can send them your client's details and your location with one tap.
            Only you can see this. Bonisa never contacts them: the buttons open WhatsApp and your phone.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="safety-name">Their name</Label>
              <Input id="safety-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama" maxLength={60} data-testid="safety-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="safety-phone">Their phone number</Label>
              <Input id="safety-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 123 4567" autoComplete="off" data-testid="safety-phone" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate({ data: { name, phone } })} disabled={save.isPending || !changed || (!!name.trim() !== !!phone.trim())} data-testid="safety-save">
              {save.isPending ? "Saving..." : "Save trusted contact"}
            </Button>
            {saved && (
              <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ data: { name: "", phone: "" } })}>Remove</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
