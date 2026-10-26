import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRequestCompletionCode, useVerifyCompletionCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * The artist's side. First she asks for a code, then she types in the one her
 * client reads from her Bonisa app. The server decides if she may do either.
 */
export function CompletionCodeEntry({ appointmentId, clientName, codeRequested }: { appointmentId: string; clientName: string; codeRequested: boolean }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stylistDashboard"] });
    qc.invalidateQueries({ queryKey: ["/api/stylists/me/payouts"] });
  };

  const request = useRequestCompletionCode({
    mutation: {
      onSuccess: () => { toast.success(`Code requested. Ask ${clientName} to open the booking in Bonisa.`); refresh(); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });
  const verify = useVerifyCompletionCode({
    mutation: {
      onSuccess: () => { setCode(""); toast.success("Service complete. You are paid after the 24 hour complaint window."); refresh(); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    },
  });

  if (!codeRequested) {
    return (
      <Button size="sm" className="gap-1.5 h-8 text-xs rounded-full" disabled={request.isPending}
        onClick={() => request.mutate({ appointmentId })}>
        <KeyRound className="h-3.5 w-3.5" strokeWidth={1.9} />Request completion code
      </Button>
    );
  }

  return (
    <form className="flex flex-col items-end gap-1.5" onSubmit={(e) => { e.preventDefault(); verify.mutate({ appointmentId, data: { code } }); }}>
      <p className="text-xs text-muted-foreground">Ask {clientName} for the code in their Bonisa app.</p>
      <div className="flex gap-1.5">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" placeholder="6 digit code" aria-label="Completion code"
          className="h-8 w-32 text-center tracking-widest" data-testid="completion-code-input"
        />
        <Button size="sm" type="submit" className="gap-1.5 h-8 text-xs rounded-full" disabled={code.length !== 6 || verify.isPending}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.9} />Complete
        </Button>
      </div>
    </form>
  );
}
