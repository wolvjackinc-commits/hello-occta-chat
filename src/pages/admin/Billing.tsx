import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Send,
  Ban,
  Eye,
  Trash2
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

type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
  vat_rate: number;
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
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidConfirmInvoice, setVoidConfirmInvoice] = useState<Invoice | null>(null);
  const [isLoadingLines, setIsLoadingLines] = useState(false);

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

  const handleSendInvoice = async (invoice: Invoice) => {
    setIsSending(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoice.id);

      if (error) throw error;

      await logAudit({
        action: "send",
        entity: "invoice",
        entityId: invoice.id,
        metadata: { invoice_number: invoice.invoice_number },
      });

      toast({ title: "Invoice marked as sent" });
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to send invoice", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidConfirmInvoice) return;
    setIsVoiding(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "cancelled" })
        .eq("id", voidConfirmInvoice.id);

      if (error) throw error;

      await logAudit({
        action: "void",
        entity: "invoice",
        entityId: voidConfirmInvoice.id,
        metadata: { invoice_number: voidConfirmInvoice.invoice_number },
      });

      toast({ title: "Invoice voided" });
      setVoidConfirmInvoice(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to void invoice", description: err.message, variant: "destructive" });
    } finally {
      setIsVoiding(false);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setViewInvoice(invoice);
    setIsLoadingLines(true);
    try {
      const { data: lines } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoice.id);
      setInvoiceLines((lines || []) as InvoiceLine[]);
    } catch (err) {
      setInvoiceLines([]);
    } finally {
      setIsLoadingLines(false);
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewInvoice(invoice)}
                          title="View invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendInvoice(invoice)}
                            disabled={isSending}
                            title="Send invoice"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkPaid(invoice)}
                              disabled={isMarkingPaid}
                              title="Mark as paid"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setVoidConfirmInvoice(invoice)}
                              title="Void invoice"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
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

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="border-4 border-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Invoice {viewInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>
              {viewInvoice && (
                <Badge className={`${getStatusColor(viewInvoice.status)} border mt-2`}>
                  {viewInvoice.status}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Customer</div>
                  <div className="font-medium">
                    {formatAccountNumber(profileMap.get(viewInvoice.user_id)?.account_number)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profileMap.get(viewInvoice.user_id)?.full_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Issue Date</div>
                  <div className="font-medium">{format(new Date(viewInvoice.issue_date), "dd MMM yyyy")}</div>
                  {viewInvoice.due_date && (
                    <>
                      <div className="text-muted-foreground mt-2">Due Date</div>
                      <div className="font-medium">{format(new Date(viewInvoice.due_date), "dd MMM yyyy")}</div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-2 border-foreground rounded-lg p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLines ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : invoiceLines.length > 0 ? (
                      invoiceLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell className="text-right">£{Number(line.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right">£{Number(line.line_total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No line items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t-2 border-foreground pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>£{Number(viewInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT (20%)</span>
                  <span>£{Number(viewInvoice.vat_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>£{Number(viewInvoice.total).toFixed(2)}</span>
                </div>
              </div>

              {viewInvoice.notes && (
                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <p className="text-sm">{viewInvoice.notes}</p>
                </div>
              )}

              <div className="flex gap-2">
                {viewInvoice.status === "draft" && (
                  <Button
                    onClick={() => {
                      handleSendInvoice(viewInvoice);
                      setViewInvoice(null);
                    }}
                    disabled={isSending}
                    className="flex-1 gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send Invoice
                  </Button>
                )}
                {viewInvoice.status !== "paid" && viewInvoice.status !== "cancelled" && (
                  <Button
                    onClick={() => {
                      handleMarkPaid(viewInvoice);
                      setViewInvoice(null);
                    }}
                    disabled={isMarkingPaid}
                    className="flex-1 gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark Paid
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    const profile = profileMap.get(viewInvoice.user_id);
                    if (profile?.account_number) {
                      navigate(`/admin/customers/${profile.account_number}`);
                    }
                  }}
                >
                  View Customer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Confirmation */}
      <AlertDialog open={!!voidConfirmInvoice} onOpenChange={(open) => !open && setVoidConfirmInvoice(null)}>
        <AlertDialogContent className="border-4 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {voidConfirmInvoice?.invoice_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleVoidInvoice}
              disabled={isVoiding}
              className="bg-destructive text-destructive-foreground"
            >
              {isVoiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
