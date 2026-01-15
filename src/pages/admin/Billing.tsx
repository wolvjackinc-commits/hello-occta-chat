import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export const AdminBilling = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    userId: "",
    invoiceNumber: "",
    description: "",
    amount: "",
    serviceId: "",
  });
  const [receiptForm, setReceiptForm] = useState({
    invoiceId: "",
    amount: "",
    method: "",
    reference: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    invoiceId: "",
    description: "",
    amount: "",
  });
  const [creditForm, setCreditForm] = useState({
    invoiceId: "",
    creditNumber: "",
    amount: "",
    reason: "",
  });

  const { data, refetch } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const [invoices, receipts, adjustments, credits, profiles] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, status, totals, issue_date, user_id, service_id")
          .order("issue_date", { ascending: false }),
        supabase.from("receipts").select("*").order("received_at", { ascending: false }),
        supabase.from("invoice_adjustments").select("*").order("created_at", { ascending: false }),
        supabase.from("credit_notes").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        invoices: invoices.data ?? [],
        receipts: receipts.data ?? [],
        adjustments: adjustments.data ?? [],
        credits: credits.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  const handleCreateInvoice = async () => {
    const totals = {
      subtotal: Number(invoiceForm.amount || 0),
      vat: 0,
      total: Number(invoiceForm.amount || 0),
    };

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceForm.invoiceNumber,
        user_id: invoiceForm.userId,
        service_id: invoiceForm.serviceId || null,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        status: "draft",
        totals,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to create invoice", variant: "destructive" });
      return;
    }

    await supabase.from("invoice_lines").insert({
      invoice_id: invoice.id,
      description: invoiceForm.description,
      qty: 1,
      unit_price: Number(invoiceForm.amount || 0),
      vat_rate: 0,
      line_total: Number(invoiceForm.amount || 0),
    });

    toast({ title: "Invoice created" });
    setOpen(false);
    setInvoiceForm({ userId: "", invoiceNumber: "", description: "", amount: "", serviceId: "" });
    refetch();
  };

  const handleAddReceipt = async () => {
    const { error } = await supabase.from("receipts").insert({
      invoice_id: receiptForm.invoiceId,
      amount: Number(receiptForm.amount || 0),
      method: receiptForm.method || null,
      reference: receiptForm.reference || null,
    });
    if (error) {
      toast({ title: "Failed to add receipt", variant: "destructive" });
      return;
    }
    toast({ title: "Receipt logged" });
    setReceiptOpen(false);
    setReceiptForm({ invoiceId: "", amount: "", method: "", reference: "" });
    refetch();
  };

  const handleAddAdjustment = async () => {
    const { error } = await supabase.from("invoice_adjustments").insert({
      invoice_id: adjustmentForm.invoiceId,
      description: adjustmentForm.description,
      amount: Number(adjustmentForm.amount || 0),
    });
    if (error) {
      toast({ title: "Failed to add adjustment", variant: "destructive" });
      return;
    }
    toast({ title: "Adjustment added" });
    setAdjustmentOpen(false);
    setAdjustmentForm({ invoiceId: "", description: "", amount: "" });
    refetch();
  };

  const handleAddCredit = async () => {
    const { error } = await supabase.from("credit_notes").insert({
      invoice_id: creditForm.invoiceId,
      credit_number: creditForm.creditNumber,
      amount: Number(creditForm.amount || 0),
      reason: creditForm.reason || null,
    });
    if (error) {
      toast({ title: "Failed to add credit note", variant: "destructive" });
      return;
    }
    toast({ title: "Credit note created" });
    setCreditOpen(false);
    setCreditForm({ invoiceId: "", creditNumber: "", amount: "", reason: "" });
    refetch();
  };

  const handleExportPdf = (invoice: any) => {
    const docWindow = window.open("", "_blank");
    if (!docWindow) return;
    const total = (invoice.totals as { total?: number })?.total ?? 0;
    docWindow.document.write(`
      <html>
        <head><title>Invoice ${invoice.invoice_number}</title></head>
        <body>
          <h1>Invoice ${invoice.invoice_number}</h1>
          <p>Status: ${invoice.status}</p>
          <p>Total: £${Number(total).toFixed(2)}</p>
        </body>
      </html>
    `);
    docWindow.document.close();
    docWindow.focus();
    docWindow.print();
  };

  const invoiceList = useMemo(() => data?.invoices ?? [], [data]);
  const receipts = data?.receipts ?? [];
  const adjustments = data?.adjustments ?? [];
  const credits = data?.credits ?? [];
  const profiles = data?.profiles ?? [];
  const invoiceStatuses = ["draft", "issued", "sent", "paid", "overdue"];
  const outstandingByCustomer = useMemo(() => {
    const totals = new Map<string, number>();
    invoiceList.forEach((invoice) => {
      if (invoice.status === "paid") return;
      const total = (invoice.totals as { total?: number })?.total ?? 0;
      totals.set(invoice.user_id, (totals.get(invoice.user_id) || 0) + Number(total));
    });
    return Array.from(totals.entries())
      .map(([userId, total]) => ({
        userId,
        total,
        name: profiles.find((profile) => profile.id === userId)?.full_name || userId,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoiceList, profiles]);

  const handleStatusUpdate = async (invoiceId: string, status: string) => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
    if (error) {
      toast({ title: "Failed to update invoice", variant: "destructive" });
      return;
    }
    toast({ title: "Invoice status updated" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Billing</h1>
          <p className="text-muted-foreground">Manage invoices, receipts, adjustments, and credit notes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>New invoice</Button>
          <Button variant="outline" onClick={() => setReceiptOpen(true)}>
            Log receipt
          </Button>
          <Button variant="outline" onClick={() => setAdjustmentOpen(true)}>
            Add adjustment
          </Button>
          <Button variant="outline" onClick={() => setCreditOpen(true)}>
            Issue credit
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {invoiceList.map((invoice) => (
          <Card key={invoice.id} className="border-2 border-foreground p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Invoice {invoice.invoice_number}</div>
                <div className="text-sm text-muted-foreground">Service: {invoice.service_id || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={invoice.status} onValueChange={(value) => handleStatusUpdate(invoice.id, value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => handleExportPdf(invoice)}>
                  Export PDF
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-foreground p-4">
        <h2 className="font-display text-lg">Outstanding balances</h2>
        <div className="space-y-2">
          {outstandingByCustomer.map((entry) => (
            <div key={entry.userId} className="flex items-center justify-between text-sm">
              <span>{entry.name}</span>
              <span>£{entry.total.toFixed(2)}</span>
            </div>
          ))}
          {!outstandingByCustomer.length && (
            <p className="text-sm text-muted-foreground">No outstanding balances.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Receipts</h2>
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">£{receipt.amount}</div>
                <div className="text-xs text-muted-foreground">{receipt.method || "—"}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Adjustments</h2>
          <div className="space-y-3">
            {adjustments.map((adjustment) => (
              <div key={adjustment.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{adjustment.description}</div>
                <div className="text-xs text-muted-foreground">£{adjustment.amount}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-2 border-foreground p-4">
          <h2 className="font-display text-lg">Credit notes</h2>
          <div className="space-y-3">
            {credits.map((credit) => (
              <div key={credit.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{credit.credit_number}</div>
                <div className="text-xs text-muted-foreground">£{credit.amount}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Customer user ID"
              value={invoiceForm.userId}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, userId: event.target.value }))}
            />
            <Input
              placeholder="Invoice number"
              value={invoiceForm.invoiceNumber}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
            />
            <Input
              placeholder="Line description"
              value={invoiceForm.description}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <Input
              placeholder="Service ID (optional)"
              value={invoiceForm.serviceId}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, serviceId: event.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={invoiceForm.amount}
              onChange={(event) => setInvoiceForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateInvoice}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Invoice ID"
              value={receiptForm.invoiceId}
              onChange={(event) => setReceiptForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={receiptForm.amount}
              onChange={(event) => setReceiptForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <Input
              placeholder="Method"
              value={receiptForm.method}
              onChange={(event) => setReceiptForm((prev) => ({ ...prev, method: event.target.value }))}
            />
            <Input
              placeholder="Reference"
              value={receiptForm.reference}
              onChange={(event) => setReceiptForm((prev) => ({ ...prev, reference: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReceiptOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddReceipt}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Invoice ID"
              value={adjustmentForm.invoiceId}
              onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
            />
            <Input
              placeholder="Description"
              value={adjustmentForm.description}
              onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={adjustmentForm.amount}
              onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAdjustment}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue credit note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Invoice ID"
              value={creditForm.invoiceId}
              onChange={(event) => setCreditForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
            />
            <Input
              placeholder="Credit note number"
              value={creditForm.creditNumber}
              onChange={(event) => setCreditForm((prev) => ({ ...prev, creditNumber: event.target.value }))}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={creditForm.amount}
              onChange={(event) => setCreditForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
            <Input
              placeholder="Reason"
              value={creditForm.reason}
              onChange={(event) => setCreditForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCredit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
