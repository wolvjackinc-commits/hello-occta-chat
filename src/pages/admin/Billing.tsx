import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { formatAccountNumber } from "@/lib/account";
import { format } from "date-fns";
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Download
} from "lucide-react";

type Invoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  notes: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

const statusOptions = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

export const AdminBilling = () => {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    accountNumber: "",
    lineItems: [{ description: "", qty: 1, unitPrice: 0 }],
    notes: "",
    dueDate: "",
  });
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Profile | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issue_date", { ascending: false });

      if (error) throw error;

      const invoiceList = (invoices || []) as Invoice[];
      const userIds = Array.from(new Set(invoiceList.map((inv) => inv.user_id)));
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_number")
          .in("id", userIds);
        profiles = (profilesData || []) as Profile[];
      }

      return { invoices: invoiceList, profiles };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    data?.profiles?.forEach((p) => map.set(p.id, p));
    return map;
  }, [data?.profiles]);

  const filteredInvoices = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return (data?.invoices || []).filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!search) return true;
      
      const profile = profileMap.get(inv.user_id);
      const accountNumber = profile?.account_number?.toLowerCase() || "";
      const name = profile?.full_name?.toLowerCase() || "";
      const invNumber = inv.invoice_number.toLowerCase();
      
      return (
        invNumber.includes(search) ||
        accountNumber.includes(search) ||
        name.includes(search)
      );
    });
  }, [data?.invoices, statusFilter, searchText, profileMap]);

  const lookupCustomer = async (accountNumber: string) => {
    if (!accountNumber.trim()) {
      setMatchedCustomer(null);
      return;
    }
    setLookingUpCustomer(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, account_number, email, full_name")
        .eq("account_number", accountNumber.trim().toUpperCase())
        .maybeSingle();
      
      if (error) throw error;
      setMatchedCustomer(data);
    } catch (err) {
      setMatchedCustomer(null);
    } finally {
      setLookingUpCustomer(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!matchedCustomer) {
      toast({ title: "Please enter a valid account number", variant: "destructive" });
      return;
    }

    const validLines = newInvoice.lineItems.filter(l => l.description.trim() && l.qty > 0);
    if (validLines.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const subtotal = validLines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
      const vatTotal = subtotal * 0.2; // 20% VAT
      const total = subtotal + vatTotal;
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: matchedCustomer.id,
          invoice_number: invoiceNumber,
          status: "draft",
          issue_date: new Date().toISOString().split('T')[0],
          due_date: newInvoice.dueDate || null,
          subtotal,
          vat_total: vatTotal,
          total,
          notes: newInvoice.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert line items
      const lineInserts = validLines.map(l => ({
        invoice_id: invoice.id,
        description: l.description,
        qty: l.qty,
        unit_price: l.unitPrice,
        line_total: l.qty * l.unitPrice,
        vat_rate: 20,
      }));

      await supabase.from("invoice_lines").insert(lineInserts);

      await logAudit({
        action: "create",
        entity: "invoice",
        entityId: invoice.id,
        metadata: { invoice_number: invoiceNumber, total },
      });

      toast({ title: "Invoice created successfully" });
      setSelectedInvoice(null);
      setNewInvoice({
        accountNumber: "",
        lineItems: [{ description: "", qty: 1, unitPrice: 0 }],
        notes: "",
        dueDate: "",
      });
      setMatchedCustomer(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    setIsMarkingPaid(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice.id);

      if (error) throw error;

      // Create receipt
      await supabase.from("receipts").insert({
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        amount: invoice.total,
        method: "manual",
        reference: `RECEIPT-${Date.now().toString(36).toUpperCase()}`,
      });

      await logAudit({
        action: "mark_paid",
        entity: "invoice",
        entityId: invoice.id,
        metadata: { invoice_number: invoice.invoice_number, amount: invoice.total },
      });

      toast({ title: "Invoice marked as paid" });
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to update invoice", description: err.message, variant: "destructive" });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-600 border-green-500";
      case "sent": return "bg-blue-500/10 text-blue-600 border-blue-500";
      case "draft": return "bg-muted text-muted-foreground";
      case "overdue": return "bg-red-500/10 text-red-600 border-red-500";
      case "cancelled": return "bg-gray-500/10 text-gray-600 border-gray-500";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Billing</h1>
          <p className="text-muted-foreground">Manage invoices, receipts, and payments.</p>
        </div>
        <Dialog>
          <Button 
            className="border-2 border-foreground gap-2"
            onClick={() => setSelectedInvoice({} as Invoice)}
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border-2 border-foreground p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="font-display uppercase text-xs">Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Invoice number, account, or name..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 border-2 border-foreground"
              />
            </div>
          </div>
          <div>
            <Label className="font-display uppercase text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1 border-2 border-foreground">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="border-2 border-foreground p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-4 border-foreground">
                <TableHead className="font-display uppercase">Invoice</TableHead>
                <TableHead className="font-display uppercase">Customer</TableHead>
                <TableHead className="font-display uppercase">Status</TableHead>
                <TableHead className="font-display uppercase">Issue Date</TableHead>
                <TableHead className="font-display uppercase">Due Date</TableHead>
                <TableHead className="font-display uppercase text-right">Total</TableHead>
                <TableHead className="font-display uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const profile = profileMap.get(invoice.user_id);
                return (
                  <TableRow key={invoice.id} className="border-b-2 border-foreground/20">
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{formatAccountNumber(profile?.account_number)}</div>
                        <div className="text-xs text-muted-foreground">{profile?.full_name || "Unknown"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(invoice.status)} border`}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(invoice.issue_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold">£{invoice.total?.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPaid(invoice)}
                          disabled={isMarkingPaid}
                          className="border-2 border-foreground gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!isLoading && filteredInvoices.length === 0 && (
          <div className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        )}
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={!!selectedInvoice && !selectedInvoice.id} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="border-4 border-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Create Invoice</DialogTitle>
            <DialogDescription>Create a new invoice for a customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-display uppercase text-sm">Account Number</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="OCC12345678"
                  value={newInvoice.accountNumber}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="border-2 border-foreground"
                />
                <Button
                  variant="outline"
                  onClick={() => lookupCustomer(newInvoice.accountNumber)}
                  disabled={lookingUpCustomer}
                  className="border-2 border-foreground"
                >
                  {lookingUpCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
                </Button>
              </div>
              {matchedCustomer && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ {matchedCustomer.full_name || matchedCustomer.email}
                </p>
              )}
            </div>

            <div>
              <Label className="font-display uppercase text-sm">Line Items</Label>
              <div className="space-y-2 mt-1">
                {newInvoice.lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const items = [...newInvoice.lineItems];
                        items[idx].description = e.target.value;
                        setNewInvoice(prev => ({ ...prev, lineItems: items }));
                      }}
                      className="col-span-6 border-2 border-foreground"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => {
                        const items = [...newInvoice.lineItems];
                        items[idx].qty = parseFloat(e.target.value) || 0;
                        setNewInvoice(prev => ({ ...prev, lineItems: items }));
                      }}
                      className="col-span-2 border-2 border-foreground"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const items = [...newInvoice.lineItems];
                        items[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setNewInvoice(prev => ({ ...prev, lineItems: items }));
                      }}
                      className="col-span-3 border-2 border-foreground"
                    />
                    <div className="col-span-1 flex items-center justify-end text-sm font-medium">
                      £{(item.qty * item.unitPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewInvoice(prev => ({
                    ...prev,
                    lineItems: [...prev.lineItems, { description: "", qty: 1, unitPrice: 0 }]
                  }))}
                  className="border-2 border-foreground"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>
            </div>

            <div>
              <Label className="font-display uppercase text-sm">Due Date</Label>
              <Input
                type="date"
                value={newInvoice.dueDate}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                className="mt-1 border-2 border-foreground"
              />
            </div>

            <div>
              <Label className="font-display uppercase text-sm">Notes</Label>
              <Textarea
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 border-2 border-foreground min-h-[80px]"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>£{newInvoice.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>VAT (20%)</span>
                <span>£{(newInvoice.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 0.2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>£{(newInvoice.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 1.2).toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handleCreateInvoice}
              disabled={isCreating || !matchedCustomer}
              className="w-full border-2 border-foreground"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
