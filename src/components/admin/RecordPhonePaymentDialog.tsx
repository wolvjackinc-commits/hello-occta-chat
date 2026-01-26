import { useState, useEffect, useCallback } from "react";
import { Phone, Loader2, User, Search, Mail, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { normalizePostcode } from "@/lib/utils";

type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
};

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  date_of_birth: string | null;
  latest_postcode: string | null;
  latest_postcode_normalized: string | null;
  created_at: string | null;
};

interface RecordPhonePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedInvoiceId?: string;
}

// Inline customer search using Popover (avoids nested dialog issue)
function InlineCustomerSearch({
  value,
  onSelect,
  disabled = false,
}: {
  value: Customer | null;
  onSelect: (customer: Customer | null) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    try {
      const q = query.trim();
      const normalizedPostcode = normalizePostcode(q);
      const isAccountNumber = /^OCC/i.test(q);
      const isPhone = /^\d{4,}$/.test(q.replace(/\D/g, ''));
      const isEmail = q.includes('@');

      let queryBuilder = supabase
        .from("admin_customer_search_view")
        .select("*")
        .limit(20);

      if (isAccountNumber) {
        queryBuilder = queryBuilder.ilike("account_number", `${q.toUpperCase()}%`);
      } else if (isEmail) {
        queryBuilder = queryBuilder.ilike("email", `%${q}%`);
      } else if (isPhone) {
        const digits = q.replace(/\D/g, '');
        queryBuilder = queryBuilder.ilike("phone", `%${digits}%`);
      } else if (normalizedPostcode.length >= 3) {
        queryBuilder = queryBuilder.or(
          `latest_postcode_normalized.ilike.%${normalizedPostcode}%,full_name.ilike.%${q}%`
        );
      } else {
        queryBuilder = queryBuilder.ilike("full_name", `%${q}%`);
      }

      const { data, error } = await queryBuilder.order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers((data || []) as Customer[]);
    } catch (err) {
      console.error("Customer search error:", err);
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchCustomers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchCustomers]);

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setOpen(false);
    setSearchQuery("");
    setCustomers([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-2 border-foreground"
          disabled={disabled}
        >
          {value ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {value.account_number || "—"}
              </Badge>
              <span className="truncate">{value.full_name || value.email || "Customer"}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Search customer...</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 !z-[60] bg-background border" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by account, name, email, phone, postcode..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[300px]">
            {loading && (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!loading && searchQuery.length < 2 && (
              <CommandEmpty>Type at least 2 characters...</CommandEmpty>
            )}
            {!loading && searchQuery.length >= 2 && customers.length === 0 && (
              <CommandEmpty>No customers found.</CommandEmpty>
            )}
            {!loading && customers.length > 0 && (
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer)}
                    className="p-2 cursor-pointer"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-primary text-sm">
                            {customer.account_number || "No Account"}
                          </span>
                          {customer.full_name && (
                            <span className="text-foreground text-sm truncate">{customer.full_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </span>
                          )}
                          {customer.latest_postcode && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {customer.latest_postcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(preSelectedInvoiceId || "");
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
        setSelectedInvoiceId("");
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
    if (selectedInvoiceId) {
      const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
      if (invoice) {
        setAmount(invoice.total.toString());
      }
    }
  }, [selectedInvoiceId, invoices]);

  const handleSubmit = async () => {
    if (!selectedInvoiceId || !amount) {
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
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          adminUserId: userData?.user?.id,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Failed to record payment");
      }

      toast({
        title: "Phone payment recorded",
        description: `Receipt ${data.receipt.reference} created.`,
      });
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
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Record Phone Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use this to log a payment taken over the phone. This will mark the invoice as paid and create a receipt.
          </p>

          {!preSelectedInvoiceId && (
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <InlineCustomerSearch
                value={selectedCustomer}
                onSelect={(customer) => {
                  setSelectedCustomer(customer);
                  setSelectedInvoiceId("");
                }}
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
            <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {invoices.length === 0 ? (
                  <SelectItem value="no-invoices" disabled>
                    No unpaid invoices found
                  </SelectItem>
                ) : (
                  invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} • £{inv.total.toFixed(2)} • {inv.status}
                    </SelectItem>
                  ))
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
            />
          </div>

          <div className="space-y-2">
            <Label>Reference (optional)</Label>
            <Input
              placeholder="e.g., Card last 4 digits, auth code"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes about the payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedInvoiceId || !amount}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
