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
import { generateInvoicePdf } from "@/lib/generateInvoicePdf";
import { format } from "date-fns";
import { CustomerPicker } from "@/components/admin/CustomerPicker";
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2, 
  CheckCircle, 
  Send,
  Ban,
  Eye,
  Download,
  Link as LinkIcon,
  CreditCard,
  Mail,
} from "lucide-react";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
  phone: string | null;
  date_of_birth: string | null;
  latest_postcode: string | null;
  latest_postcode_normalized: string | null;
  created_at: string | null;
};

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

type CommunicationLog = {
  id: string;
  invoice_id: string | null;
  payment_request_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
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
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [communicationsLog, setCommunicationsLog] = useState<CommunicationLog[]>([]);
  const [isLoadingComms, setIsLoadingComms] = useState(false);

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    lineItems: [{ description: "", qty: 1, unitPrice: 0 }],
    notes: "",
    dueDate: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  const handleCreateInvoice = async () => {
    if (!selectedCustomer) {
      toast({ title: "Please select a customer", variant: "destructive" });
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
          user_id: selectedCustomer.id,
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
        lineItems: [{ description: "", qty: 1, unitPrice: 0 }],
        notes: "",
        dueDate: "",
      });
      setSelectedCustomer(null);
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
      const receiptRef = `RECEIPT-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("receipts").insert({
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        amount: invoice.total,
        method: "manual",
        reference: receiptRef,
      });

      await logAudit({
        action: "mark_paid",
        entity: "invoice",
        entityId: invoice.id,
        metadata: { invoice_number: invoice.invoice_number, amount: invoice.total },
      });

      // Send payment confirmation email
      const profile = profileMap.get(invoice.user_id);
      if (profile?.email) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "invoice_paid",
              to: profile.email,
              data: {
                customer_name: profile.full_name || "Customer",
                invoice_number: invoice.invoice_number,
                total: invoice.total,
                paid_date: format(new Date(), "dd MMM yyyy"),
                receipt_reference: receiptRef,
              },
            },
          });
          toast({ title: "Invoice marked as paid", description: "Payment confirmation email sent" });
        } catch (emailErr) {
          console.error("Failed to send payment email:", emailErr);
          toast({ title: "Invoice marked as paid", description: "Email notification failed" });
        }
      } else {
        toast({ title: "Invoice marked as paid" });
      }

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
      // Fetch invoice lines for email
      const { data: lines } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoice.id);

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

      // Send invoice email
      const profile = profileMap.get(invoice.user_id);
      if (profile?.email) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "invoice_sent",
              to: profile.email,
              data: {
                customer_name: profile.full_name || "Customer",
                account_number: profile.account_number || "",
                invoice_number: invoice.invoice_number,
                issue_date: format(new Date(invoice.issue_date), "dd MMM yyyy"),
                due_date: invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : null,
                subtotal: invoice.subtotal,
                vat_total: invoice.vat_total,
                total: invoice.total,
                lines: (lines || []).map((l) => ({
                  description: l.description,
                  qty: l.qty,
                  line_total: l.line_total,
                })),
              },
            },
          });
          toast({ title: "Invoice sent", description: "Email notification sent to customer" });
        } catch (emailErr) {
          console.error("Failed to send invoice email:", emailErr);
          toast({ title: "Invoice marked as sent", description: "Email notification failed" });
        }
      } else {
        toast({ title: "Invoice marked as sent" });
      }

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
    setIsLoadingComms(true);
    setCommunicationsLog([]);
    
    try {
      // Fetch invoice lines and communications log in parallel
      const [linesResult, commsResult] = await Promise.all([
        supabase.from("invoice_lines").select("*").eq("invoice_id", invoice.id),
        supabase
          .from("communications_log" as any)
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      
      setInvoiceLines((linesResult.data || []) as InvoiceLine[]);
      setCommunicationsLog((commsResult.data || []) as unknown as CommunicationLog[]);
    } catch {
      setInvoiceLines([]);
      setCommunicationsLog([]);
    } finally {
      setIsLoadingLines(false);
      setIsLoadingComms(false);
    }
  };

  const handleSendPaymentLink = async (invoice: Invoice) => {
    const profile = profileMap.get(invoice.user_id);
    if (!profile?.email) {
      toast({ title: "No email address", description: "Customer has no email on file.", variant: "destructive" });
      return;
    }

    setIsSendingPaymentLink(true);
    try {
      // Generate secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

      // Create payment request
      const { data: paymentRequest, error: prError } = await supabase
        .from("payment_requests")
        .insert({
          type: "card_payment",
          invoice_id: invoice.id,
          user_id: invoice.user_id,
          customer_email: profile.email,
          customer_name: profile.full_name || "Customer",
          account_number: profile.account_number || null,
          amount: invoice.total,
          currency: "GBP",
          status: "sent",
          expires_at: expiresAt.toISOString(),
          token_hash: token, // In production, hash this
          notes: `Payment for invoice ${invoice.invoice_number}`,
        })
        .select()
        .single();

      if (prError) throw prError;

      // Send email with payment link
      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          type: "payment_link",
          to: profile.email,
          logToCommunications: true,
          invoiceId: invoice.id,
          paymentRequestId: paymentRequest.id,
          data: {
            customer_name: profile.full_name || "Customer",
            account_number: profile.account_number || "",
            invoice_number: invoice.invoice_number,
            amount: invoice.total,
            due_date: invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : null,
            expires_at: expiresAt.toISOString(),
            token: token,
          },
        },
      });

      if (emailError) throw emailError;

      await logAudit({
        action: "send",
        entity: "payment_request",
        entityId: paymentRequest.id,
        metadata: { 
          invoice_id: invoice.id, 
          invoice_number: invoice.invoice_number,
          amount: invoice.total,
        },
      });

      toast({ 
        title: "Payment link sent", 
        description: `Email sent to ${profile.email}`,
      });

      // Refresh communications log
      if (viewInvoice?.id === invoice.id) {
        const { data: comms } = await supabase
          .from("communications_log" as any)
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at", { ascending: false })
          .limit(20);
        setCommunicationsLog((comms || []) as unknown as CommunicationLog[]);
      }
    } catch (err: any) {
      console.error("Failed to send payment link:", err);
      toast({ 
        title: "Failed to send payment link", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSendingPaymentLink(false);
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
        <Button 
          className="border-2 border-foreground gap-2"
          onClick={() => setSelectedInvoice({} as Invoice)}
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
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
                              onClick={() => {
                                const paymentLink = `${window.location.origin}/pay-invoice?id=${invoice.id}`;
                                navigator.clipboard.writeText(paymentLink);
                                toast({
                                  title: "Payment link copied",
                                  description: "Send this link to the customer to pay online.",
                                });
                              }}
                              title="Copy payment link"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </Button>
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

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const profile = profileMap.get(viewInvoice.user_id);
                    generateInvoicePdf({
                      invoiceNumber: viewInvoice.invoice_number,
                      customerName: profile?.full_name || "Customer",
                      customerEmail: profile?.email || "",
                      accountNumber: profile?.account_number || "",
                      issueDate: viewInvoice.issue_date,
                      dueDate: viewInvoice.due_date || undefined,
                      status: viewInvoice.status,
                      lines: invoiceLines.map(l => ({
                        description: l.description,
                        qty: l.qty,
                        unit_price: l.unit_price,
                        line_total: l.line_total,
                      })),
                      subtotal: viewInvoice.subtotal,
                      vatTotal: viewInvoice.vat_total,
                      total: viewInvoice.total,
                      notes: viewInvoice.notes || undefined,
                    });
                  }}
                  className="gap-2 border-2 border-foreground"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
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
                  <>
                    <Button
                      onClick={() => handleSendPaymentLink(viewInvoice)}
                      disabled={isSendingPaymentLink}
                      variant="outline"
                      className="gap-2 border-2 border-foreground"
                    >
                      {isSendingPaymentLink ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Send Payment Link
                    </Button>
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
                  </>
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

              {/* Communication History */}
              <div className="border-t-2 border-foreground pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4" />
                  <h4 className="font-display text-sm uppercase">Communication History</h4>
                </div>
                {isLoadingComms ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : communicationsLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No emails sent for this invoice yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {communicationsLog.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              log.status === "sent" 
                                ? "border-green-500 text-green-600" 
                                : log.status === "failed" 
                                ? "border-red-500 text-red-600" 
                                : ""
                            }`}
                          >
                            {log.status}
                          </Badge>
                          <span className="font-medium">
                            {log.template_name.replace(/_/g, " ")}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground truncate max-w-[150px]">
                            {log.recipient_email}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {log.sent_at 
                            ? format(new Date(log.sent_at), "dd MMM HH:mm") 
                            : format(new Date(log.created_at), "dd MMM HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
              <Label className="font-display uppercase text-sm">Customer</Label>
              <div className="mt-1">
                <CustomerPicker
                  value={selectedCustomer}
                  onSelect={setSelectedCustomer}
                  placeholder="Search by name, account, email, phone, or postcode..."
                />
              </div>
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
              disabled={isCreating || !selectedCustomer}
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
