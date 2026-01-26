import { useState, useEffect } from "react";
import { Phone, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { CustomerPickerPopover, type Customer } from "@/components/admin/CustomerPicker";

type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
};

interface RecordPhonePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedInvoiceId?: string;
}

export function RecordPhonePaymentDialog({
  open,
  onOpenChange,
  onSuccess,
  preSelectedInvoiceId,
}: RecordPhonePaymentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(preSelectedInvoiceId || "PLACEHOLDER");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (preSelectedInvoiceId) {
        setSelectedInvoiceId(preSelectedInvoiceId);
      } else {
        setSelectedCustomer(null);
        setInvoices([]);
        setSelectedInvoiceId("PLACEHOLDER");
        setAmount("");
        setReference("");
        setNotes("");
      }
    }
  }, [open, preSelectedInvoiceId]);

  // Load invoices when customer is selected
  useEffect(() => {
    if (!selectedCustomer) {
      setInvoices([]);
      return;
    }

    const loadInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const { data: invoiceData } = await supabase
          .from("invoices")
          .select("id, invoice_number, total, status")
          .eq("user_id", selectedCustomer.id)
          .in("status", ["draft", "sent", "overdue"])
          .order("created_at", { ascending: false });

        setInvoices(invoiceData || []);
      } catch (err) {
        console.error("Failed to load invoices:", err);
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    loadInvoices();
  }, [selectedCustomer]);

  // Auto-fill amount when invoice selected
  useEffect(() => {
    if (selectedInvoiceId && selectedInvoiceId !== "PLACEHOLDER") {
      const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
      if (invoice) {
        setAmount(invoice.total.toString());
      }
    }
  }, [selectedInvoiceId, invoices]);

  const handleSubmit = async () => {
    if (!selectedInvoiceId || selectedInvoiceId === "PLACEHOLDER" || !amount) {
      toast({ title: "Please select an invoice and enter amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "record-phone-payment",
          invoiceId: selectedInvoiceId,
          amount: parseFloat(amount),
          reference,
          notes,
          adminUserId: userData?.user?.id,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Failed to record payment");
      }

      toast({ title: "Payment recorded successfully", description: "Receipt has been created." });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-4 border-foreground" aria-describedby="dialog-desc">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Record Phone Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p id="dialog-desc" className="text-sm text-muted-foreground">
            Use this to log a payment taken over the phone. This will mark the invoice as paid and create a receipt.
          </p>

          {!preSelectedInvoiceId && (
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <CustomerPickerPopover
                value={selectedCustomer}
                onSelect={(customer) => {
                  setSelectedCustomer(customer);
                  setSelectedInvoiceId("PLACEHOLDER");
                }}
                placeholder="Search by name, account, email, phone, postcode, DOB..."
              />
              {selectedCustomer && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 border-2 border-primary/20 rounded">
                  <User className="w-4 h-4 text-primary" />
                  <div className="text-sm">
                    <span className="font-medium">{selectedCustomer.full_name || "Customer"}</span>
                    <Badge variant="outline" className="ml-2 font-mono text-xs">
                      {selectedCustomer.account_number}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Invoice *</Label>
            <Select value={selectedInvoiceId} onValueChange={(val) => val !== "PLACEHOLDER" && setSelectedInvoiceId(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingInvoices ? (
                  <SelectItem value="PLACEHOLDER" disabled>
                    Loading invoices...
                  </SelectItem>
                ) : invoices.length === 0 ? (
                  <SelectItem value="PLACEHOLDER" disabled>
                    {selectedCustomer ? "No unpaid invoices found" : "Select a customer first"}
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value="PLACEHOLDER" disabled>
                      Select an invoice
                    </SelectItem>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} • £{inv.total.toFixed(2)} • {inv.status}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount (£) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Reference</Label>
            <Input
              placeholder="e.g., Card ending 1234, Bank transfer"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border-2 border-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-foreground">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedInvoiceId || selectedInvoiceId === "PLACEHOLDER" || !amount}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecordPhonePaymentDialog;
