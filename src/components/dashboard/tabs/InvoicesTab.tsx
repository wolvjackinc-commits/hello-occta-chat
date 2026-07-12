import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  CreditCard,
  Download,
  Loader2,
  Receipt,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | unpaid | paid | overdue
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, Invoice>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const buildAndDownload = async (invoiceId: string) => {
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
  };

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      await buildAndDownload(invoiceId);
      toast.success(`Invoice ${invoiceNumber} downloaded`);
      logClientEvent({ event_type: "invoice_view_from_dashboard", title: "invoice.download", source_module: "dashboard" });
    } catch (err) {
      logError("InvoicesTab.handleDownload", err);
      toast.error("Couldn't download invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBulkDownload = async () => {
    const list = Object.values(selected);
    if (list.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const inv of list) {
      try {
        // Space out slightly so the browser doesn't drop simultaneous downloads.
        await buildAndDownload(inv.id);
        ok += 1;
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        logError("InvoicesTab.handleBulkDownload", err);
      }
    }
    setBulkBusy(false);
    if (ok === list.length) {
      toast.success(`Downloaded ${ok} invoice${ok === 1 ? "" : "s"}`);
    } else {
      toast.error(`Downloaded ${ok} of ${list.length}. Some invoices failed — please retry.`);
    }
    setSelected({});
    logClientEvent({ event_type: "invoice_view_from_dashboard", title: "invoice.bulk_download", source_module: "dashboard" });
  };

  const toggleSelected = (inv: Invoice) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[inv.id]) delete next[inv.id];
      else next[inv.id] = inv;
      return next;
    });
  };

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:invoices", source_module: "dashboard" });
    (async () => {
      const [u, p, c] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,total,status,due_date,issue_date").eq("user_id", userId).in("status", ["draft", "sent", "overdue"]).order("due_date", { ascending: true }),
        supabase.from("invoices").select("id,invoice_number,total,status,due_date,issue_date").eq("user_id", userId).eq("status", "paid").order("issue_date", { ascending: false }).limit(100),
        supabase.from("credit_notes").select("id,invoice_id,amount,reason,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      setUnpaid((u.data as Invoice[]) || []);
      setPaid((p.data as Invoice[]) || []);
      setCredits((c.data as CreditNote[]) || []);
    })();
  }, [userId]);

  const outstandingTotal = useMemo(() => unpaid.reduce((s, i) => s + Number(i.total), 0), [unpaid]);
  const paidTotal = useMemo(() => paid.reduce((s, i) => s + Number(i.total), 0), [paid]);
  const earliestDue = useMemo(() => {
    const withDue = unpaid.filter((i) => i.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
    return withDue[0]?.due_date ?? null;
  }, [unpaid]);

  const q = search.trim().toLowerCase();
  const now = new Date();
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
  const inDateRange = (iso: string | null) => {
    if (!iso) return true;
    const d = new Date(iso);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  const matches = (i: Invoice) => (!q || i.invoice_number.toLowerCase().includes(q)) && inDateRange(i.issue_date);
  const isOverdue = (i: Invoice) => !!i.due_date && new Date(i.due_date) < now && i.status !== "paid";

  const showUnpaid = statusFilter === "all" || statusFilter === "unpaid" || statusFilter === "overdue";
  const showPaid = statusFilter === "all" || statusFilter === "paid";

  const unpaidFiltered = unpaid.filter((i) => matches(i) && (statusFilter !== "overdue" || isOverdue(i)));
  const paidFiltered = paid.filter(matches);
  const filtersActive = q || statusFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const selectedCount = Object.keys(selected).length;
  const selectedTotal = Object.values(selected).reduce((s, i) => s + Number(i.total), 0);
  const visibleIds = [
    ...(showUnpaid ? unpaidFiltered.map((i) => i.id) : []),
    ...(showPaid ? paidFiltered.map((i) => i.id) : []),
  ];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => !!selected[id]);
  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = { ...prev };
        visibleIds.forEach((id) => delete next[id]);
        return next;
      }
      const next = { ...prev };
      [...unpaidFiltered, ...paidFiltered].forEach((inv) => {
        if (
          (showUnpaid && !isOverdue(inv) && inv.status !== "paid") ||
          (showUnpaid && isOverdue(inv)) ||
          (showPaid && inv.status === "paid")
        ) {
          next[inv.id] = inv;
        }
      });
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-4 border-4 ${unpaid.length ? "border-destructive bg-destructive/10" : "border-foreground bg-background"}`}>
          <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" /> Outstanding
          </div>
          <p className="font-display text-2xl mt-1">£{outstandingTotal.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            {unpaid.length} invoice{unpaid.length === 1 ? "" : "s"}
            {earliestDue ? ` · next due ${format(new Date(earliestDue), "dd MMM yyyy")}` : ""}
          </p>
        </div>
        <div className="p-4 border-4 border-foreground bg-background">
          <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> Paid (last 20)
          </div>
          <p className="font-display text-2xl mt-1">£{paidTotal.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{paid.length} invoice{paid.length === 1 ? "" : "s"}</p>
        </div>
        <div className="p-4 border-4 border-foreground bg-background">
          <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider">
            <Receipt className="w-4 h-4" /> Credits
          </div>
          <p className="font-display text-2xl mt-1">
            £{credits.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">{credits.length} note{credits.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {/* Filters + bulk toolbar */}
      {(unpaid.length + paid.length) > 0 && (
        <div className="border-4 border-foreground bg-background p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number…"
                className="pl-9 border-2 border-foreground"
              />
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-2 border-foreground">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All invoices</SelectItem>
                  <SelectItem value="unpaid">Unpaid only</SelectItem>
                  <SelectItem value="overdue">Overdue only</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inv-from" className="text-xs uppercase font-display text-muted-foreground">From</Label>
              <Input
                id="inv-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-2 border-foreground"
              />
            </div>
            <div>
              <Label htmlFor="inv-to" className="text-xs uppercase font-display text-muted-foreground">To</Label>
              <Input
                id="inv-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-2 border-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-display uppercase tracking-wider cursor-pointer">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                aria-label="Select all visible invoices"
              />
              Select all visible
            </label>
            {filtersActive && (
              <Button
                variant="outline"
                size="sm"
                className="border-2 border-foreground"
                onClick={clearFilters}
              >
                <X className="w-3 h-3 mr-1" /> Clear filters
              </Button>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-2 border-primary bg-primary/10">
              <p className="text-sm">
                <strong>{selectedCount}</strong> selected · £{selectedTotal.toFixed(2)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-2 border-foreground" onClick={() => setSelected({})}>
                  Deselect
                </Button>
                <Button variant="hero" size="sm" onClick={handleBulkDownload} disabled={bulkBusy}>
                  {bulkBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  Download selected
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
      {showUnpaid && (
      <section>
        <h3 className="font-display uppercase mb-3">Unpaid invoices</h3>
        {unpaidFiltered.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No matches" : "No unpaid invoices"}
            message={filtersActive ? "Try adjusting your filters." : "You're all caught up — nothing to pay right now."}
          />
        ) : (
          <div className="space-y-2">
            {unpaidFiltered.map((inv) => {
              const overdue = isOverdue(inv);
              const isSel = !!selected[inv.id];
              return (
                <div key={inv.id} className={`flex items-center gap-3 p-4 border-4 bg-background ${overdue ? "border-destructive" : "border-foreground"} ${isSel ? "ring-2 ring-primary" : ""}`}>
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggleSelected(inv)}
                    aria-label={`Select invoice ${inv.invoice_number}`}
                  />
                  <div className="flex-1 min-w-0">
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
      )}

      {showPaid && (
      <section>
        <h3 className="font-display uppercase mb-3">Paid invoices</h3>
        {paidFiltered.length === 0 ? (
          <EmptyState title={filtersActive ? "No matches" : "No paid invoices yet"} />
        ) : (
          <div className="space-y-2">
            {paidFiltered.map((inv) => {
              const isSel = !!selected[inv.id];
              return (
              <div key={inv.id} className={`flex items-center gap-3 p-3 border-2 border-foreground bg-background ${isSel ? "ring-2 ring-primary" : ""}`}>
                <Checkbox
                  checked={isSel}
                  onCheckedChange={() => toggleSelected(inv)}
                  aria-label={`Select invoice ${inv.invoice_number}`}
                />
                <div className="flex-1 min-w-0">
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
              );
            })}
          </div>
        )}
      </section>
      )}

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