import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
  Info,
} from "lucide-react";
import { format } from "date-fns";

type DDMandateCustomerView = {
  id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  created_at: string;
};

const DD_GUARANTEE_TEXT = `This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.

If there are any changes to the amount, date or frequency of your Direct Debit, OCCTA Limited will notify you (normally 10 working days) in advance of your account being debited or as otherwise agreed. If you request OCCTA Limited to collect a payment, confirmation of the amount and date will be given to you at the time of the request.

If an error is made in the payment of your Direct Debit, by OCCTA Limited or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.

If you receive a refund you are not entitled to, you must pay it back when OCCTA Limited asks you to.

You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.`;

interface DirectDebitStatusProps {
  userId: string;
}

export function DirectDebitStatus({ userId }: DirectDebitStatusProps) {
  const [mandates, setMandates] = useState<DDMandateCustomerView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMandates();
  }, [userId]);

  const fetchMandates = async () => {
    setLoading(true);
    try {
      // Customer can only see their own mandates via RLS
      // Only fetch safe fields - no full account numbers, sort codes, addresses, or consent details
      const { data, error } = await supabase
        .from("dd_mandates_list")
        .select("id, status, mandate_reference, bank_last4, account_holder, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMandates((data || []) as DDMandateCustomerView[]);
    } catch (err) {
      console.error("Error fetching DD mandates:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-primary border-2 border-foreground gap-1">
            <CheckCircle className="w-3 h-3" />
            Active
          </Badge>
        );
      case "pending":
      case "verified":
      case "submitted_to_provider":
        return (
          <Badge className="bg-warning border-2 border-foreground gap-1">
            <Clock className="w-3 h-3" />
            {status === "pending" ? "Pending Verification" : 
             status === "verified" ? "Verified" : "Processing"}
          </Badge>
        );
      case "cancelled":
      case "failed":
        return (
          <Badge className="bg-destructive border-2 border-foreground gap-1">
            <XCircle className="w-3 h-3" />
            {status === "cancelled" ? "Cancelled" : "Failed"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-2 border-foreground">
            {status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="card-brutal bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5" />
          <h3 className="font-display text-lg">DIRECT DEBIT</h3>
        </div>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // Filter to show only relevant mandates (not cancelled/failed unless recent)
  const activeMandates = mandates.filter(m => ["active", "pending", "verified", "submitted_to_provider"].includes(m.status));
  const inactiveMandates = mandates.filter(m => ["cancelled", "failed"].includes(m.status));

  return (
    <Card className="card-brutal bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          DIRECT DEBIT
        </h3>
        {activeMandates.length > 0 && (
          <Badge variant="outline" className="border-2 border-foreground">
            {activeMandates.length} active
          </Badge>
        )}
      </div>

      {mandates.length === 0 ? (
        <div className="py-6 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-2">No Direct Debit set up</p>
          <p className="text-xs text-muted-foreground">
            Contact us to set up automatic payments via Direct Debit
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeMandates.map((mandate) => (
            <div
              key={mandate.id}
              className="border-4 border-foreground p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(mandate.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ref: {mandate.mandate_reference || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Account Holder</p>
                  <p className="font-medium">{mandate.account_holder || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Bank Account</p>
                  <p className="font-mono">****{mandate.bank_last4 || "****"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Set Up</p>
                  <p>{format(new Date(mandate.created_at), "dd MMM yyyy")}</p>
                </div>
              </div>

              {mandate.status === "pending" && (
                <div className="mt-3 p-2 bg-warning/10 border-2 border-warning/50 text-sm">
                  <p className="flex items-center gap-2 text-warning-foreground">
                    <Clock className="w-4 h-4" />
                    Your Direct Debit is being verified (1-2 business days)
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Direct Debit Guarantee */}
          <Accordion type="single" collapsible className="border-2 border-foreground">
            <AccordionItem value="guarantee" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="font-display text-sm">Direct Debit Guarantee</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="bg-muted p-3 rounded text-xs leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                  {DD_GUARANTEE_TEXT}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Your payments are protected by the Direct Debit Guarantee
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Inactive mandates (collapsed) */}
          {inactiveMandates.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="inactive" className="border-0">
                <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2">
                  Show {inactiveMandates.length} inactive mandate{inactiveMandates.length !== 1 ? "s" : ""}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {inactiveMandates.map((mandate) => (
                      <div
                        key={mandate.id}
                        className="border-2 border-foreground/20 p-3 opacity-60"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono">{mandate.mandate_reference || "—"}</span>
                          {getStatusBadge(mandate.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(mandate.created_at), "dd MMM yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </Card>
  );
}

export default DirectDebitStatus;
