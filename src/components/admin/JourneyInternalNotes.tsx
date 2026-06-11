import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StickyNote, Lock } from "lucide-react";

/**
 * Admin-only internal notes for a customer journey.
 * RLS on `journey_internal_notes` blocks anon and non-admin reads/writes.
 * Notes are append-only (15-minute author edit window, no deletes).
 */
export function JourneyInternalNotes({
  customerId,
  paymentRequestId,
  quoteId,
  contractSummaryId,
}: {
  customerId: string;
  paymentRequestId?: string | null;
  quoteId?: string | null;
  contractSummaryId?: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const notesQ = useQuery({
    queryKey: ["journey_internal_notes", customerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("journey_internal_notes")
        .select("id,body,created_at,updated_at,author_user_id,payment_request_id,quote_id,contract_summary_id")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; body: string; created_at: string; updated_at: string;
        author_user_id: string; payment_request_id: string | null;
        quote_id: string | null; contract_summary_id: string | null;
      }>;
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const author = u.user?.id;
      if (!author) throw new Error("Not signed in");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note cannot be empty");
      if (trimmed.length > 4000) throw new Error("Note exceeds 4000 chars");
      const { error } = await (supabase as any).from("journey_internal_notes").insert({
        customer_id: customerId,
        payment_request_id: paymentRequestId ?? null,
        quote_id: quoteId ?? null,
        contract_summary_id: contractSummaryId ?? null,
        author_user_id: author,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      toast({ title: "Note added", description: "Internal-only. Not visible to the customer." });
      qc.invalidateQueries({ queryKey: ["journey_internal_notes", customerId] });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't add note", description: e?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="border-4 border-foreground bg-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="w-5 h-5" />
        <h3 className="font-display uppercase text-lg">Internal journey notes</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-xs uppercase border-2 border-foreground px-2 py-0.5">
          <Lock className="w-3 h-3" /> Admin only
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Never visible to customers. Append-only, audited. Cannot change legal or payment status.
      </p>

      <div className="space-y-2 mb-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add an internal note for this customer journey…"
          maxLength={4000}
          className="border-2 border-foreground"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/4000</span>
          <Button
            onClick={() => addM.mutate()}
            disabled={addM.isPending || !body.trim()}
            className="border-2 border-foreground"
          >
            {addM.isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {notesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notesQ.error ? (
          <p className="text-sm text-destructive">Couldn't load notes.</p>
        ) : !notesQ.data?.length ? (
          <p className="text-sm text-muted-foreground">No internal notes yet.</p>
        ) : (
          notesQ.data.map((n) => (
            <div key={n.id} className="border-2 border-foreground/20 p-2 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                {format(new Date(n.created_at), "dd MMM yyyy HH:mm")}
                {n.updated_at !== n.created_at && <> · edited</>}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default JourneyInternalNotes;