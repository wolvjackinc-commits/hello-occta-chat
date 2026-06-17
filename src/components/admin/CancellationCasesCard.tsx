import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

function gbp(minor?: number | null) {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

type Props = { customerId: string };

export function CancellationCasesCard({ customerId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [giacomRef, setGiacomRef] = useState<Record<string, string>>({});
  const [supplierDate, setSupplierDate] = useState<Record<string, string>>({});
  const [actualDate, setActualDate] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const { data: cases } = useQuery({
    queryKey: ["admin-cancellation-cases", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_cancellation_cases")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function call(action: string, payload: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const { error } = await supabase.functions.invoke("service-cancellation", { body: { action, ...payload } });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-cancellation-cases", customerId] });
      toast({ title: "Updated" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  if (!cases || cases.length === 0) {
    return (
      <Card className="border-2 border-foreground p-4 text-sm text-muted-foreground">
        No cancellation cases for this customer.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {cases.map((c: any) => {
        const p = c.preview_snapshot ?? {};
        const isOpen = !["completed", "withdrawn", "rejected"].includes(c.status);
        return (
          <Card key={c.id} className="border-2 border-foreground p-4 rounded-none space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-display uppercase text-sm">Case {c.id.slice(0, 8)} · {c.source}</div>
              <Badge variant="secondary" className="rounded-none uppercase">{c.status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div>Requested: {new Date(c.created_at).toLocaleString("en-GB")}</div>
              <div>Reason: {c.reason_code ?? "—"}</div>
              <div>Proposed cease: {p.proposed_cease_date ?? "—"}</div>
              <div>Notice: {p.notice_period_days ?? "—"} days</div>
              <div>Min term ends: {p.minimum_term_end_date ?? "—"}</div>
              <div>Within min term: {String(!!p.within_minimum_term)}</div>
              <div>Last billed through: {p.last_billed_through ?? "—"}</div>
              <div>Unpaid invoices: {gbp(p.unpaid_invoices_minor)}</div>
              <div>Unbilled service: {gbp(p.unbilled_service_minor)}</div>
              <div>ETF ({p.etf_method ?? "—"}): {gbp(p.etf_minor)}</div>
              <div>Credits: {gbp(p.credits_minor)}</div>
              <div className="font-display">Final balance: {gbp(p.final_balance_minor)}</div>
              <div>Formula: {c.preview_formula_version ?? "—"}</div>
            </div>
            {(c.manual_review_reasons ?? []).length > 0 && (
              <div className="text-xs p-2 border-2 border-warning bg-warning/10">
                Manual review: {(c.manual_review_reasons ?? []).join(", ")}
              </div>
            )}

            {isOpen && (
              <div className="flex flex-wrap gap-2 pt-2 border-t-2 border-foreground/20">
                <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => call("preview", { case_id: c.id }, c.id)}>
                  Recompute preview
                </Button>

                {["preview_ready", "manual_review_required"].includes(c.status) && (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={!!confirmed[c.id]} onCheckedChange={(v) => setConfirmed((s) => ({ ...s, [c.id]: !!v }))} />
                    I have reviewed the customer's accepted agreement, notice period, billing position and any applicable early termination charge.
                  </label>
                )}
                {["preview_ready", "manual_review_required"].includes(c.status) && (
                  <Button size="sm" disabled={!confirmed[c.id] || busy === c.id}
                    onClick={() => call("approve", { case_id: c.id, staff_confirmed: true }, c.id)}>
                    Approve & create Giacom cease task
                  </Button>
                )}

                {c.status === "approved_for_cease" && (
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs">Giacom reference</Label>
                      <Input value={giacomRef[c.id] ?? c.giacom_cease_reference ?? ""} onChange={(e) => setGiacomRef((s) => ({ ...s, [c.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" disabled={busy === c.id}
                      onClick={() => call("record_giacom_submission", { case_id: c.id, giacom_reference: giacomRef[c.id] ?? c.giacom_cease_reference }, c.id)}>
                      Record Giacom submission
                    </Button>
                  </div>
                )}

                {c.status === "submitted_to_giacom" && (
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs">Supplier cease date</Label>
                      <Input type="date" value={supplierDate[c.id] ?? ""} onChange={(e) => setSupplierDate((s) => ({ ...s, [c.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" disabled={busy === c.id}
                      onClick={() => call("mark_cease_committed", { case_id: c.id, supplier_cease_date: supplierDate[c.id] }, c.id)}>
                      Mark cease committed
                    </Button>
                  </div>
                )}

                {["cease_committed", "submitted_to_giacom"].includes(c.status) && (
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs">Actual cease date</Label>
                      <Input type="date" value={actualDate[c.id] ?? c.supplier_confirmed_cease_date ?? ""} onChange={(e) => setActualDate((s) => ({ ...s, [c.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" variant="destructive" disabled={!actualDate[c.id] || busy === c.id}
                      onClick={() => call("confirm_cease", { case_id: c.id, actual_cease_date: actualDate[c.id] }, c.id)}>
                      Confirm cease & finalise
                    </Button>
                  </div>
                )}

                {!["cease_committed", "completed"].includes(c.status) && (
                  <Button size="sm" variant="ghost" disabled={busy === c.id}
                    onClick={() => call("withdraw", { case_id: c.id, reason: "admin_withdrew" }, c.id)}>
                    Withdraw
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}