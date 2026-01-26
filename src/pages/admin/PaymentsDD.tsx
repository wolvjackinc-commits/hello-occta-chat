import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { formatAccountNumber } from "@/lib/account";
import { format } from "date-fns";
import { 
  CreditCard, 
  Plus, 
  Search, 
  Loader2,
  Building,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Ban
} from "lucide-react";
import { DDMandateDetailDialog } from "@/components/admin/DDMandateDetailDialog";

type DDMandate = {
  id: string;
  user_id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  consent_timestamp: string | null;
  payment_request_id: string | null;
  created_at: string;
  updated_at: string;
  has_bank_details?: boolean;
  sort_code_masked?: string;
  account_number_masked?: string;
};

type PaymentAttempt = {
  id: string;
  user_id: string;
  invoice_id: string | null;
  amount: number;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  reason: string | null;
  attempted_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

// Status options removed - unused

export const AdminPaymentsDD = () => {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("mandates");
  const [isCreatingMandate, setIsCreatingMandate] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMandate, setViewMandate] = useState<DDMandate | null>(null);
  const [cancelConfirmMandate, setCancelConfirmMandate] = useState<DDMandate | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // New mandate form
  const [newMandate, setNewMandate] = useState({
    accountNumber: "",
    accountHolder: "",
    bankLast4: "",
    mandateReference: "",
  });
  const [matchedCustomer, setMatchedCustomer] = useState<Profile | null>(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  // Fetch DD Mandates using the dd_mandates_list view (includes masked fields)
  const { data: mandatesData, isLoading: mandatesLoading, refetch: refetchMandates } = useQuery({
    queryKey: ["admin-dd-mandates"],
    queryFn: async () => {
      const { data: mandates, error } = await supabase
        .from("dd_mandates_list")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mandateList = (mandates || []) as DDMandate[];
      const userIds = Array.from(new Set(mandateList.map((m) => m.user_id)));
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_number")
          .in("id", userIds);
        profiles = (profilesData || []) as Profile[];
      }

      return { mandates: mandateList, profiles };
    },
  });

  // Fetch Payment Attempts
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ["admin-payment-attempts"],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payment_attempts")
        .select("*")
        .order("attempted_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const paymentList = (payments || []) as PaymentAttempt[];
      const userIds = Array.from(new Set(paymentList.map((p) => p.user_id)));
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_number")
          .in("id", userIds);
        profiles = (profilesData || []) as Profile[];
      }

      return { payments: paymentList, profiles };
    },
  });

  const mandateProfileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    mandatesData?.profiles?.forEach((p) => map.set(p.id, p));
    return map;
  }, [mandatesData?.profiles]);

  const paymentProfileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    paymentsData?.profiles?.forEach((p) => map.set(p.id, p));
    return map;
  }, [paymentsData?.profiles]);

  const filteredMandates = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return (mandatesData?.mandates || []).filter((m) => {
      if (!search) return true;
      const profile = mandateProfileMap.get(m.user_id);
      return (
        profile?.account_number?.toLowerCase().includes(search) ||
        profile?.full_name?.toLowerCase().includes(search) ||
        m.mandate_reference?.toLowerCase().includes(search)
      );
    });
  }, [mandatesData?.mandates, searchText, mandateProfileMap]);

  const filteredPayments = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return (paymentsData?.payments || []).filter((p) => {
      if (!search) return true;
      const profile = paymentProfileMap.get(p.user_id);
      return (
        profile?.account_number?.toLowerCase().includes(search) ||
        profile?.full_name?.toLowerCase().includes(search) ||
        p.provider_ref?.toLowerCase().includes(search)
      );
    });
  }, [paymentsData?.payments, searchText, paymentProfileMap]);

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
    } catch {
      setMatchedCustomer(null);
    } finally {
      setLookingUpCustomer(false);
    }
  };

  const handleCreateMandate = async () => {
    if (!matchedCustomer) {
      toast({ title: "Please enter a valid account number", variant: "destructive" });
      return;
    }

    setIsCreatingMandate(true);
    try {
      const mandateRef = newMandate.mandateReference || `DDR-${Date.now().toString(36).toUpperCase()}`;
      
      const { data: mandate, error } = await supabase
        .from("dd_mandates")
        .insert({
          user_id: matchedCustomer.id,
          status: "pending",
          mandate_reference: mandateRef,
          bank_last4: newMandate.bankLast4 || null,
          account_holder: newMandate.accountHolder || null,
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit({
        action: "create",
        entity: "dd_mandate",
        entityId: mandate.id,
        metadata: { mandate_reference: mandateRef },
      });

      toast({ title: "DD Mandate created successfully" });
      setShowCreateDialog(false);
      setNewMandate({ accountNumber: "", accountHolder: "", bankLast4: "", mandateReference: "" });
      setMatchedCustomer(null);
      refetchMandates();
    } catch (err: any) {
      toast({ title: "Failed to create mandate", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingMandate(false);
    }
  };

  // handleUpdateMandateStatus removed - status updates are done via DDMandateDetailDialog

  const handleCancelMandate = async () => {
    if (!cancelConfirmMandate) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("dd_mandates")
        .update({ status: "cancelled" })
        .eq("id", cancelConfirmMandate.id);

      if (error) throw error;

      await logAudit({
        action: "cancel",
        entity: "dd_mandate",
        entityId: cancelConfirmMandate.id,
        metadata: { 
          mandate_reference: cancelConfirmMandate.mandate_reference,
          previous_status: cancelConfirmMandate.status,
        },
      });

      toast({ title: "Mandate cancelled" });
      setCancelConfirmMandate(null);
      refetchMandates();
    } catch (err: any) {
      toast({ title: "Failed to cancel mandate", description: err.message, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleActivateMandate = async (mandate: DDMandate) => {
    try {
      const { error } = await supabase
        .from("dd_mandates")
        .update({ status: "active" })
        .eq("id", mandate.id);

      if (error) throw error;

      await logAudit({
        action: "activate",
        entity: "dd_mandate",
        entityId: mandate.id,
        metadata: { 
          mandate_reference: mandate.mandate_reference,
          previous_status: mandate.status,
        },
      });

      toast({ title: "Mandate activated" });
      refetchMandates();
    } catch (err: any) {
      toast({ title: "Failed to activate mandate", description: err.message, variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "succeeded":
        return "bg-green-500/10 text-green-600 border-green-500";
      case "pending":
      case "initiated":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500";
      case "failed":
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500";
      default:
        return "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
      case "initiated":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "failed":
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Payments & Direct Debit</h1>
          <p className="text-muted-foreground">Manage DD mandates and track payment attempts.</p>
        </div>
        <Button 
          className="border-2 border-foreground gap-2"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4" />
          Create DD Mandate
        </Button>
      </div>

      {/* Search */}
      <Card className="border-2 border-foreground p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by account number, name, or reference..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 border-2 border-foreground"
          />
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-2 border-foreground">
          <TabsTrigger value="mandates">DD Mandates ({mandatesData?.mandates?.length || 0})</TabsTrigger>
          <TabsTrigger value="payments">Payment Attempts ({paymentsData?.payments?.length || 0})</TabsTrigger>
        </TabsList>

        {/* DD Mandates Tab */}
        <TabsContent value="mandates" className="mt-4">
          <Card className="border-2 border-foreground p-4">
            {mandatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">Customer</TableHead>
                    <TableHead className="font-display uppercase">Reference</TableHead>
                    <TableHead className="font-display uppercase">Account Holder</TableHead>
                    <TableHead className="font-display uppercase">Bank</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Created</TableHead>
                    <TableHead className="font-display uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMandates.map((mandate) => {
                    const profile = mandateProfileMap.get(mandate.user_id);
                    return (
                      <TableRow key={mandate.id} className="border-b-2 border-foreground/20">
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatAccountNumber(profile?.account_number)}</div>
                            <div className="text-xs text-muted-foreground">{profile?.full_name || "Unknown"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{mandate.mandate_reference || "—"}</TableCell>
                        <TableCell>{mandate.account_holder || "—"}</TableCell>
                        <TableCell>
                          {mandate.bank_last4 ? `****${mandate.bank_last4}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(mandate.status)} border gap-1`}>
                            {getStatusIcon(mandate.status)}
                            {mandate.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(mandate.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewMandate(mandate)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {mandate.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleActivateMandate(mandate)}
                                title="Activate mandate"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {mandate.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCancelConfirmMandate(mandate)}
                                title="Cancel mandate"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!mandatesLoading && filteredMandates.length === 0 && (
              <div className="py-8 text-center">
                <Building className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No DD mandates found</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Payment Attempts Tab */}
        <TabsContent value="payments" className="mt-4">
          <Card className="border-2 border-foreground p-4">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">Customer</TableHead>
                    <TableHead className="font-display uppercase">Amount</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Provider</TableHead>
                    <TableHead className="font-display uppercase">Reference</TableHead>
                    <TableHead className="font-display uppercase">Reason</TableHead>
                    <TableHead className="font-display uppercase">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const profile = paymentProfileMap.get(payment.user_id);
                    return (
                      <TableRow key={payment.id} className="border-b-2 border-foreground/20">
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatAccountNumber(profile?.account_number)}</div>
                            <div className="text-xs text-muted-foreground">{profile?.full_name || "Unknown"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">£{payment.amount?.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(payment.status)} border gap-1`}>
                            {getStatusIcon(payment.status)}
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.provider || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{payment.provider_ref || "—"}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={payment.reason || ""}>
                          {payment.reason || "—"}
                        </TableCell>
                        <TableCell>{format(new Date(payment.attempted_at), "dd MMM yyyy HH:mm")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!paymentsLoading && filteredPayments.length === 0 && (
              <div className="py-8 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No payment attempts found</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create DD Mandate Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">Create DD Mandate</DialogTitle>
            <DialogDescription>Set up a new Direct Debit mandate for a customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-display uppercase text-sm">Account Number</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="OCC12345678"
                  value={newMandate.accountNumber}
                  onChange={(e) => setNewMandate(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className="border-2 border-foreground"
                />
                <Button
                  variant="outline"
                  onClick={() => lookupCustomer(newMandate.accountNumber)}
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
              <Label className="font-display uppercase text-sm">Account Holder Name</Label>
              <Input
                placeholder="John Smith"
                value={newMandate.accountHolder}
                onChange={(e) => setNewMandate(prev => ({ ...prev, accountHolder: e.target.value }))}
                className="mt-1 border-2 border-foreground"
              />
            </div>

            <div>
              <Label className="font-display uppercase text-sm">Bank Account (last 4 digits)</Label>
              <Input
                placeholder="1234"
                maxLength={4}
                value={newMandate.bankLast4}
                onChange={(e) => setNewMandate(prev => ({ ...prev, bankLast4: e.target.value.replace(/\D/g, "") }))}
                className="mt-1 border-2 border-foreground"
              />
            </div>

            <div>
              <Label className="font-display uppercase text-sm">Mandate Reference (optional)</Label>
              <Input
                placeholder="Auto-generated if empty"
                value={newMandate.mandateReference}
                onChange={(e) => setNewMandate(prev => ({ ...prev, mandateReference: e.target.value }))}
                className="mt-1 border-2 border-foreground"
              />
            </div>

            <Button
              onClick={handleCreateMandate}
              disabled={isCreatingMandate || !matchedCustomer}
              className="w-full border-2 border-foreground"
            >
              {isCreatingMandate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Mandate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Mandate Dialog - Full Details with Reveal Flow */}
      {viewMandate && (
        <DDMandateDetailDialog
          open={!!viewMandate}
          onOpenChange={(open) => !open && setViewMandate(null)}
          mandate={{
            id: viewMandate.id,
            user_id: viewMandate.user_id,
            status: viewMandate.status,
            mandate_reference: viewMandate.mandate_reference,
            bank_last4: viewMandate.bank_last4,
            account_holder: viewMandate.account_holder,
            consent_timestamp: viewMandate.consent_timestamp,
            payment_request_id: viewMandate.payment_request_id,
            created_at: viewMandate.created_at,
            updated_at: viewMandate.updated_at || viewMandate.created_at,
            has_bank_details: viewMandate.has_bank_details,
            sort_code_masked: viewMandate.sort_code_masked,
            account_number_masked: viewMandate.account_number_masked,
          }}
          onUpdate={() => refetchMandates()}
        />
      )}

      {/* Cancel Mandate Confirmation */}
      <AlertDialog open={!!cancelConfirmMandate} onOpenChange={(open) => !open && setCancelConfirmMandate(null)}>
        <AlertDialogContent className="border-4 border-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Cancel DD Mandate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel mandate {cancelConfirmMandate?.mandate_reference}? 
              This will stop all future Direct Debit payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-foreground">Keep Mandate</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelMandate}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cancel Mandate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
