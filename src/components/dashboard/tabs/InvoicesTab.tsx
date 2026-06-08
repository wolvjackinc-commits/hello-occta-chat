import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CreditCard, Receipt } from "lucide-react";
import { PaymentHistory } from "@/components/dashboard/PaymentHistory";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";

type Invoice = { id: string; invoice_number: string; total: number; status: string; due_date: string | null; issue_date: string };
type CreditNote = { id: string; invoice_id: string; amount: number; reason: string | null; created_at: string };

export function InvoicesTab({ userId }: { userId: string }) {
  const [unpaid, setUnpaid] = useState<Invoice[]>([]);
  const [paid, setPaid] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<CreditNote[]>([]);

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:invoices", source_module: "dashboard" });
    (async () => {
      const [u, p, c] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,total,status,due_date,issue_date").eq("user_id", userId).in("status", ["draft", "sent", "overdue"]).order("due_date", { ascending: true }),
        supabase.from("invoices").select("id,invoice_number,total,status,due_date,issue_date").eq("user_id", userId).eq("status", "paid").order("issue_date", { ascending: false }).limit(20),
        supabase.from("credit_notes").select("id,invoice_id,amount,reason,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      setUnpaid((u.data as Invoice[]) || []);
      setPaid((p.data as Invoice[]) || []);
      setCredits((c.data as CreditNote[]) || []);
    })();
  }, [userId]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display uppercase mb-3">Unpaid invoices</h3>
        {unpaid.length === 0 ? (
          <EmptyState title="No unpaid invoices" message="You're all caught up." />
        ) : (
          <div className="space-y-2">
            {unpaid.map((inv) => {
              const overdue = inv.due_date && new Date(inv.due_date) < new Date();
              return (
                <div key={inv.id} className={`flex items-center justify-between p-4 border-4 bg-background ${overdue ? "border-destructive" : "border-foreground"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display">{inv.invoice_number}</p>
                      {overdue && <Badge className="bg-destructive border-2 border-foreground">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Due {inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display text-lg">£{Number(inv.total).toFixed(2)}</p>
                    <Link to={`/pay-invoice?id=${inv.id}`} onClick={() => logClientEvent({ event_type: "invoice_view_from_dashboard", title: "invoice.pay", source_module: "dashboard" })}>
                      <Button size="sm" variant="hero"><CreditCard className="w-4 h-4 mr-1" /> Pay now</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display uppercase mb-3">Paid invoices</h3>
        {paid.length === 0 ? (
          <EmptyState title="No paid invoices yet" />
        ) : (
          <div className="space-y-2">
            {paid.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                <div>
                  <p className="font-display text-sm">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), "dd MMM yyyy")}</p>
                </div>
                <p className="font-display">£{Number(inv.total).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display uppercase mb-3 flex items-center gap-2"><Receipt className="w-4 h-4" /> Receipts & payment history</h3>
        <PaymentHistory userId={userId} showTitle={false} />
      </section>

      {credits.length > 0 && (
        <section>
          <h3 className="font-display uppercase mb-3">Credit notes</h3>
          <div className="space-y-2">
            {credits.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                <div>
                  <p className="text-sm">{c.reason || "Credit note"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</p>
                </div>
                <p className="font-display">£{Number(c.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}