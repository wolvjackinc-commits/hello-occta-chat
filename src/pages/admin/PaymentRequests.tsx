import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CreditCard,
  Building2,
  Send,
  Copy,
  RotateCcw,
  XCircle,
  ExternalLink,
  FileText,
  Plus,
  Filter,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Phone,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { isAccountNumberValid } from "@/lib/validators";
import { DDMandateDetailDialog } from "@/components/admin/DDMandateDetailDialog";
import { RecordPhonePaymentDialog } from "@/components/admin/RecordPhonePaymentDialog";

type PaymentRequest = {
  id: string;
  created_at: string;
  created_by: string | null;
  user_id: string | null;
  account_number: string | null;
  type: "card_payment" | "dd_setup";
  status: "draft" | "sent" | "opened" | "completed" | "failed" | "cancelled";
  amount: number | null;
  currency: string;
  invoice_id: string | null;
  due_date: string | null;
  customer_email: string;
  customer_name: string;
  notes: string | null;
  token_hash: string | null;
  expires_at: string | null;
  last_opened_at: string | null;
  completed_at: string | null;
  provider: string | null;
  provider_reference: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "secondary", icon: <FileText className="h-3 w-3" /> },
  sent: { label: "Sent", variant: "default", icon: <Send className="h-3 w-3" /> },
  opened: { label: "Opened", variant: "outline", icon: <Eye className="h-3 w-3" /> },
  completed: { label: "Completed", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", variant: "secondary", icon: <XCircle className="h-3 w-3" /> },
};

export const AdminPaymentRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    accountNumber: "",
    type: "card_payment" as "card_payment" | "dd_setup",
    amount: "",
    invoiceId: "",
    notes: "",
    dueDate: "",
  });
  const [matchedCustomer, setMatchedCustomer] = useState<{
    id: string;
    full_name: string | null;
    email: string | null;
    account_number: string | null;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // View dialog
  const [viewRequest, setViewRequest] = useState<PaymentRequest | null>(null);
  
  // DD Mandate detail dialog
  const [selectedDDMandate, setSelectedDDMandate] = useState<any>(null);
  const [showDDMandateDialog, setShowDDMandateDialog] = useState(false);
  
  // Phone payment dialog
  const [showPhonePaymentDialog, setShowPhonePaymentDialog] = useState(false);

  // Fetch payment requests
  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["payment-requests", statusFilter, typeFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (searchTerm.trim()) {
        query = query.or(
          `account_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []) as PaymentRequest[];
    },
  });

  // Fetch invoices for linking
  const { data: invoices = [] } = useQuery({
    queryKey: ["unpaid-invoices", matchedCustomer?.id],
    enabled: !!matchedCustomer && createForm.type === "card_payment",
    queryFn: async () => {
      if (!matchedCustomer) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, status")
        .eq("user_id", matchedCustomer.id)
        .in("status", ["draft", "sent", "overdue"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });

  // Lookup customer by account number
  useEffect(() => {
    const normalizedAccountNumber = createForm.accountNumber.trim().toUpperCase();
    if (!isAccountNumberValid(normalizedAccountNumber)) {
      setMatchedCustomer(null);
      return;
    }

    setIsLookingUp(true);
    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_number")
        .eq("account_number", normalizedAccountNumber)
        .maybeSingle();
      
      if (!error && data) {
        setMatchedCustomer(data);
      } else {
        setMatchedCustomer(null);
      }
      setIsLookingUp(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [createForm.accountNumber]);

  const handleCreateRequest = async (sendImmediately: boolean) => {
    if (!matchedCustomer) {
      toast({ title: "Please enter a valid customer account number", variant: "destructive" });
      return;
    }

    if (createForm.type === "card_payment" && !createForm.amount) {
      toast({ title: "Amount is required for card payments", variant: "destructive" });
      return;
    }

    if (!matchedCustomer.email) {
      toast({ title: "Customer does not have an email address", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      
      // Generate token for secure link
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const rawToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
      
      // Hash the token for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const insertData = {
        created_by: currentUser?.user?.id || null,
        user_id: matchedCustomer.id,
        account_number: matchedCustomer.account_number,
        type: createForm.type,
        status: sendImmediately ? "sent" : "draft",
        amount: createForm.type === "card_payment" ? parseFloat(createForm.amount) : null,
        currency: "GBP",
        invoice_id: createForm.invoiceId || null,
        due_date: createForm.dueDate || null,
        customer_email: matchedCustomer.email,
        customer_name: matchedCustomer.full_name || "Customer",
        notes: createForm.notes || null,
        token_hash: sendImmediately ? tokenHash : null,
        expires_at: sendImmediately ? expiresAt.toISOString() : null,
        provider: createForm.type === "card_payment" ? "worldpay" : null,
      };

      const { data: newRequest, error } = await supabase
        .from("payment_requests")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Log event
      await supabase.from("payment_request_events").insert({
        request_id: newRequest.id,
        event_type: "created",
        metadata: { created_by: currentUser?.user?.id },
      });

      await logAudit({
        action: "create",
        entity: "invoice",
        entityId: newRequest.id,
        metadata: { type: createForm.type, account_number: matchedCustomer.account_number },
      });

      if (sendImmediately) {
        // Send email via edge function
        const { error: emailError } = await supabase.functions.invoke("payment-request", {
          body: {
            action: "send-email",
            requestId: newRequest.id,
            rawToken,
          },
        });

        if (emailError) {
          toast({ title: "Request created but email failed to send", variant: "destructive" });
        } else {
          await supabase.from("payment_request_events").insert({
            request_id: newRequest.id,
            event_type: "sent",
            metadata: { email: matchedCustomer.email },
          });
          toast({ title: "Payment request sent successfully" });
        }
      } else {
        toast({ title: "Payment request saved as draft" });
      }

      setShowCreateDialog(false);
      setCreateForm({ accountNumber: "", type: "card_payment", amount: "", invoiceId: "", notes: "", dueDate: "" });
      setMatchedCustomer(null);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to create request", description: message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendRequest = async (request: PaymentRequest) => {
    setIsSending(true);
    try {
      // Generate new token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const rawToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
      
      const encoder = new TextEncoder();
      const data = encoder.encode(rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase
        .from("payment_requests")
        .update({
          status: "sent",
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", request.id);

      const { error: emailError } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "send-email",
          requestId: request.id,
          rawToken,
        },
      });

      if (emailError) throw emailError;

      await supabase.from("payment_request_events").insert({
        request_id: request.id,
        event_type: "sent",
        metadata: { email: request.customer_email },
      });

      toast({ title: "Payment request sent" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to send request", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelRequest = async (request: PaymentRequest) => {
    try {
      await supabase
        .from("payment_requests")
        .update({ status: "cancelled" })
        .eq("id", request.id);

      await supabase.from("payment_request_events").insert({
        request_id: request.id,
        event_type: "cancelled",
        metadata: {},
      });

      await logAudit({
        action: "cancel",
        entity: "invoice",
        entityId: request.id,
      });

      toast({ title: "Request cancelled" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to cancel request", description: message, variant: "destructive" });
    }
  };

  const handleCopyLink = async (request: PaymentRequest) => {
    // For copy, we need the raw token which we can't recover from hash
    // Instead, copy a reference to view it in admin
    const baseUrl = "https://www.occta.co.uk";
    const path = request.type === "card_payment" ? "/pay" : "/dd/setup";
    toast({
      title: "Link info",
      description: `Customer received link at: ${request.customer_email}. Link is ${baseUrl}${path}?token=...`,
    });
  };

  // Handle viewing DD mandate details
  const handleViewDDMandate = async (request: PaymentRequest) => {
    // Fetch the DD mandate linked to this payment request
    const { data: mandate } = await supabase
      .from("dd_mandates")
      .select("*")
      .eq("payment_request_id", request.id)
      .maybeSingle();
    
    if (mandate) {
      setSelectedDDMandate(mandate);
      setShowDDMandateDialog(true);
    } else {
      toast({ title: "No DD mandate found for this request", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Payment Requests</h1>
          <p className="text-muted-foreground">
            Send secure payment links to customers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPhonePaymentDialog(true)} className="gap-2">
            <Phone className="h-4 w-4" />
            Record Phone Payment
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="card_payment">Card Payment</SelectItem>
                <SelectItem value="dd_setup">DD Setup</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search by account, name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[280px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl mb-2">No payment requests</h3>
              <p className="text-muted-foreground">
                Create a new request to send a secure payment link to a customer.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.draft;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="text-sm">
                        {format(new Date(request.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {request.account_number || "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{request.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {request.type === "card_payment" ? (
                            <CreditCard className="h-3 w-3" />
                          ) : (
                            <Building2 className="h-3 w-3" />
                          )}
                          {request.type === "card_payment" ? "Card" : "DD Setup"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.amount ? `£${request.amount.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.due_date ? format(new Date(request.due_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewRequest(request)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {request.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleSendRequest(request)}>
                                <Send className="mr-2 h-4 w-4" />
                                Send Now
                              </DropdownMenuItem>
                            )}
                            {request.status === "sent" && (
                              <>
                                <DropdownMenuItem onClick={() => handleCopyLink(request)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Link Info
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendRequest(request)}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Resend Email
                                </DropdownMenuItem>
                              </>
                            )}
                            {request.invoice_id && (
                              <DropdownMenuItem
                                onClick={() => window.open(`/admin/billing?invoice=${request.invoice_id}`, "_blank")}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Open Invoice
                              </DropdownMenuItem>
                            )}
                            {request.user_id && (
                              <DropdownMenuItem
                                onClick={() => window.open(`/admin/customers/${request.user_id}`, "_blank")}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Customer
                              </DropdownMenuItem>
                            )}
                            {/* DD Mandate details for DD setup requests */}
                            {request.type === "dd_setup" && ["opened", "completed"].includes(request.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleViewDDMandate(request)}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  View DD Mandate
                                </DropdownMenuItem>
                              </>
                            )}
                            {["draft", "sent", "opened"].includes(request.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCancelRequest(request)}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Request
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Create Payment Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input
                placeholder="OCC12345678"
                value={createForm.accountNumber}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, accountNumber: e.target.value.toUpperCase() }))
                }
              />
              {isLookingUp && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up customer...
                </p>
              )}
              {matchedCustomer && (
                <p className="text-xs text-primary">
                  ✓ {matchedCustomer.full_name} • {matchedCustomer.email}
                </p>
              )}
              {!matchedCustomer && isAccountNumberValid(createForm.accountNumber) && !isLookingUp && (
                <p className="text-xs text-destructive">Customer not found</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Request Type *</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, type: v as "card_payment" | "dd_setup" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card_payment">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Card Payment
                    </div>
                  </SelectItem>
                  <SelectItem value="dd_setup">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Direct Debit Setup
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createForm.type === "card_payment" && (
              <>
                <div className="space-y-2">
                  <Label>Amount (GBP) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                {invoices.length > 0 && (
                  <div className="space-y-2">
                    <Label>Link to Invoice (optional)</Label>
                    <Select
                      value={createForm.invoiceId}
                      onValueChange={(v) => {
                        setCreateForm((prev) => ({ ...prev, invoiceId: v }));
                        const inv = invoices.find((i) => i.id === v);
                        if (inv) {
                          setCreateForm((prev) => ({ ...prev, amount: inv.total.toString() }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No invoice</SelectItem>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number} • £{inv.total.toFixed(2)} • {inv.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={createForm.dueDate}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (internal)</Label>
              <Textarea
                placeholder="Optional internal notes..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreateRequest(false)}
              disabled={isCreating || !matchedCustomer}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Draft
            </Button>
            <Button
              onClick={() => handleCreateRequest(true)}
              disabled={isCreating || !matchedCustomer}
              className="gap-2"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={() => setViewRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Request Details
            </DialogTitle>
          </DialogHeader>
          {viewRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Account</Label>
                  <p className="font-mono">{viewRequest.account_number || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p>{viewRequest.type === "card_payment" ? "Card Payment" : "DD Setup"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p>{viewRequest.customer_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="truncate">{viewRequest.customer_email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount</Label>
                  <p>{viewRequest.amount ? `£${viewRequest.amount.toFixed(2)}` : "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={STATUS_CONFIG[viewRequest.status]?.variant || "secondary"}>
                    {STATUS_CONFIG[viewRequest.status]?.label || viewRequest.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p>{format(new Date(viewRequest.created_at), "dd MMM yyyy HH:mm")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expires</Label>
                  <p>
                    {viewRequest.expires_at
                      ? format(new Date(viewRequest.expires_at), "dd MMM yyyy")
                      : "—"}
                  </p>
                </div>
                {viewRequest.last_opened_at && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Last Opened</Label>
                    <p>{format(new Date(viewRequest.last_opened_at), "dd MMM yyyy HH:mm")}</p>
                  </div>
                )}
                {viewRequest.completed_at && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Completed</Label>
                    <p>{format(new Date(viewRequest.completed_at), "dd MMM yyyy HH:mm")}</p>
                  </div>
                )}
                {viewRequest.notes && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm">{viewRequest.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DD Mandate Detail Dialog */}
      <DDMandateDetailDialog
        mandate={selectedDDMandate}
        open={showDDMandateDialog}
        onOpenChange={setShowDDMandateDialog}
        onUpdate={() => {
          refetch();
          setShowDDMandateDialog(false);
        }}
      />

      {/* Phone Payment Dialog */}
      <RecordPhonePaymentDialog
        open={showPhonePaymentDialog}
        onOpenChange={setShowPhonePaymentDialog}
        onSuccess={refetch}
      />
    </div>
  );
};

export default AdminPaymentRequests;
