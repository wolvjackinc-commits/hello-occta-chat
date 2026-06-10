import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Search } from "lucide-react";

type Match = { id: string; email: string | null; full_name: string | null; account_number: string | null };

export function LinkQuoteRequestDialog({
  open,
  onOpenChange,
  quoteRequestId,
  quoteRequestEmail,
  currentCustomerId,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteRequestId: string | null;
  quoteRequestEmail: string | null;
  currentCustomerId: string | null;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const runSearch = async () => {
    const term = query.trim();
    if (term.length < 2) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, account_number")
        .or(`email.ilike.%${term}%,full_name.ilike.%${term}%,account_number.ilike.%${term}%`)
        .limit(10);
      setResults((data as Match[]) ?? []);
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!quoteRequestId || !selected) return;
    if (reason.trim().length < 4) {
      toast({ title: "Reason required", description: "Add a short reason for the audit log.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc("admin_link_quote_request", {
      _qr_id: quoteRequestId,
      _new_user_id: selected.id,
      _reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Link failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Linked", description: "Quote request linked and audit log written." });
    onLinked();
    onOpenChange(false);
    setSelected(null);
    setReason("");
    setQuery("");
    setResults([]);
  };

  const emailMismatch =
    !!(selected?.email && quoteRequestEmail && selected.email.toLowerCase() !== quoteRequestEmail.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link quote request to customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Quote request email: <span className="font-mono">{quoteRequestEmail ?? "—"}</span>
            {currentCustomerId && <> · Currently linked to <span className="font-mono">{currentCustomerId.slice(0, 8)}…</span></>}
          </div>
          <div>
            <Label className="text-xs">Search customer (email / name / account number)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                placeholder="e.g. jane@example.com or OCC12345678"
              />
              <Button type="button" variant="outline" onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          {results.length > 0 && (
            <div className="border-2 border-foreground/20 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-2 text-sm border-b last:border-b-0 hover:bg-muted/40 ${
                    selected?.id === r.id ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="font-medium">{r.full_name ?? "(no name)"} <span className="text-xs font-mono text-muted-foreground">{r.account_number ?? ""}</span></div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </button>
              ))}
            </div>
          )}
          {selected && emailMismatch && (
            <div className="flex gap-2 items-start border-2 border-warning/40 bg-warning/10 p-2 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning" />
              <span>Email does not match this quote request. Confirm manual override reason below.</span>
            </div>
          )}
          <div>
            <Label className="text-xs">Reason (written to audit log) *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={submit} disabled={!selected || submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Linking…</> : "Link customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}