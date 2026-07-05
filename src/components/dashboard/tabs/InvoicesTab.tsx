import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CreditCard, Download, Loader2, Receipt } from "lucide-react";
import { PaymentHistory } from "@/components/dashboard/PaymentHistory";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";
import { generateInvoicePdf } from "@/lib/generateInvoicePdf";
import { toast } from "sonner";
import { logError } from "@/lib/logger";

type Invoice = { id: string; invoice_number: string; total: number; status: string; due_date: string | null; issue_date: string };
type CreditNote = { id: string; invoice_id: string; amount: number; reason: string | null; created_at: string };

export function InvoicesTab({ userId }: { userId: string }) {
  const [unpaid, setUnpaid] = useState<Invoice[]>([]);
  const [paid, setPaid] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const [invRes, linesRes, profileRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
        supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
        supabase.from("customer_profile" as any).select("*").eq("id", userId).maybeSingle(),
      ]);
      if (invRes.error || !invRes.data) throw invRes.error ?? new Error("invoice_missing");
      const inv: any = invRes.data;
      const profile: any = profileRes.data ?? {};
      const lines = (linesRes.data as any[]) ?? [];
      generateInvoicePdf({
        invoiceNumber: inv.invoice_number,
        customerName: profile.full_name || "Customer",
        customerEmail: profile.email || "",
        accountNumber: profile.account_number || "",
        postcode: profile.postcode || "",
        issueDate: inv.issue_date,
        dueDate: inv.due_date ?? undefined,
        status: inv.status,
        lines: lines.map((l) => ({
          description: l.description ?? "",
          qty: Number(l.qty ?? 1),
          unit_price: Number(l.unit_price ?? 0),
          line_total: Number(l.line_total ?? 0),
          vat_rate: l.vat_rate != null ? Number(l.vat_rate) : undefined,
        })),
        subtotal: Number(inv.subtotal ?? 0),
        vatTotal: Number(inv.vat_total ?? 0),
        total: Number(inv.total ?? 0),
        notes: inv.notes ?? undefined,
        vatEnabled: inv.vat_enabled !== false,
        vatRate: inv.vat_rate != null ? Number(inv.vat_rate) : 20,
      });
      toast.success(`Invoice ${invoiceNumber} downloaded`);
      logClientEvent({ event_type: "invoice_download", title: "invoice.download", source_module: "dashboard" });
    } catch (err) {
      logError("InvoicesTab.handleDownload", err);
      toast.error("Couldn't download invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

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
      <div className="border-4 border-foreground bg-muted/40 p-4 text-sm">
        <p className="font-display uppercase text-xs mb-1">How your billing works</p>
        <p className="text-muted-foreground">
          Billing starts only once your service is confirmed live. Your first invoice may include your
          activation fee and a pro-rata charge from your live date to your chosen billing date. After
          that, your monthly service is billed in advance on your selected billing date.
        </p>
        <p className="text-muted-foreground mt-2">
          <strong>Invoice link customers:</strong> You are not automatically charged. We send you an
          invoice with a secure payment link, and you pay manually.
        </p>
      </div>
      <section>
        <h3 className="font-display uppercase mb-3">Unpaid invoices</h3>
        {unpaid.length === 0 ? (
          <EmptyState title="No unpaid invoices" message="You're all caught up — nothing to pay right now." />
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
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <p className="font-display text-lg">£{Number(inv.total).toFixed(2)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-2 border-foreground"
                      onClick={() => handleDownload(inv.id, inv.invoice_number)}
                      disabled={downloadingId === inv.id}
                      aria-label={`Download invoice ${inv.invoice_number}`}
                    >
                      {downloadingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </Button>
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
              <div key={inv.id} className="flex items-center justify-between gap-3 p-3 border-2 border-foreground bg-background">
                <div className="min-w-0">
                  <p className="font-display text-sm truncate">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), "dd MMM yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-display">£{Number(inv.total).toFixed(2)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-2 border-foreground"
                    onClick={() => handleDownload(inv.id, inv.invoice_number)}
                    disabled={downloadingId === inv.id}
                    aria-label={`Download invoice ${inv.invoice_number}`}
                  >
                    {downloadingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                </div>
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