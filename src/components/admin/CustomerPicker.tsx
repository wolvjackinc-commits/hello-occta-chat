import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, User, Copy, Eye, EyeOff, Loader2, MapPin, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { normalizePostcode } from "@/lib/utils";

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

interface CustomerPickerProps {
  value?: Customer | null;
  onSelect: (customer: Customer | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showQuickActions?: boolean;
  trigger?: React.ReactNode;
}

export function CustomerPicker({
  value,
  onSelect,
  placeholder = "Search customer...",
  disabled = false,
  showQuickActions = false,
  trigger,
}: CustomerPickerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDob, setShowDob] = useState<Record<string, boolean>>({});

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
      // Check if DOB format (dd/mm/yyyy or yyyy-mm-dd)
      const isDob = /^\d{2}\/\d{2}\/\d{4}$/.test(q) || /^\d{4}-\d{2}-\d{2}$/.test(q);

      let queryBuilder = supabase
        .from("admin_customer_search_view")
        .select("*")
        .limit(20);

      if (isAccountNumber) {
        // Exact match priority for account numbers
        queryBuilder = queryBuilder.ilike("account_number", `${q.toUpperCase()}%`);
      } else if (isEmail) {
        queryBuilder = queryBuilder.ilike("email", `%${q}%`);
      } else if (isPhone) {
        const digits = q.replace(/\D/g, '');
        queryBuilder = queryBuilder.ilike("phone", `%${digits}%`);
      } else if (isDob) {
        // Convert dd/mm/yyyy to yyyy-mm-dd for DB query
        let dobForQuery = q;
        if (q.includes('/')) {
          const parts = q.split('/');
          if (parts.length === 3) {
            dobForQuery = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        queryBuilder = queryBuilder.eq("date_of_birth", dobForQuery);
      } else if (normalizedPostcode.length >= 3) {
        // Try postcode match OR name search
        queryBuilder = queryBuilder.or(
          `latest_postcode_normalized.ilike.%${normalizedPostcode}%,full_name.ilike.%${q}%`
        );
      } else {
        // Name search (supports partial matches)
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

  const handleCopy = async (text: string | null, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const toggleDob = (customerId: string) => {
    setShowDob(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  const formatDob = (dob: string | null, customerId: string) => {
    if (!dob) return "—";
    if (!showDob[customerId]) return "••/••/••••";
    return format(new Date(dob), "dd/MM/yyyy");
  };

  const renderCustomerItem = (customer: Customer) => (
    <CommandItem
      key={customer.id}
      value={customer.id}
      onSelect={() => handleSelect(customer)}
      className="p-3 cursor-pointer"
    >
      <div className="flex items-start gap-3 w-full">
        <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-primary">
              {customer.account_number || "No Account"}
            </span>
            {customer.full_name && (
              <span className="text-foreground truncate">{customer.full_name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            {customer.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {customer.phone}
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
  );

  const renderSelectedValue = () => {
    if (!value) return <span className="text-muted-foreground">{placeholder}</span>;
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {value.account_number || "—"}
        </Badge>
        <span className="truncate">{value.full_name || value.email || "Customer"}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {trigger || (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between border-2 border-foreground"
            disabled={disabled}
          >
            {renderSelectedValue()}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 border-4 border-foreground">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="font-display">Select Customer</DialogTitle>
        </DialogHeader>
        <Command className="border-0" shouldFilter={false}>
          <CommandInput
            placeholder="Search by account, name, email, phone, postcode, or DOB..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[400px]">
            {loading && (
              <div className="p-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {!loading && searchQuery.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
            )}
            {!loading && searchQuery.length >= 2 && customers.length === 0 && (
              <CommandEmpty>No customers found.</CommandEmpty>
            )}
            {!loading && customers.length > 0 && (
              <CommandGroup heading={`${customers.length} customer${customers.length !== 1 ? 's' : ''} found`}>
                {customers.map(renderCustomerItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {showQuickActions && value && (
          <div className="p-4 border-t-2 border-foreground bg-muted/50">
            <Label className="text-xs uppercase text-muted-foreground mb-2 block">
              Quick Actions
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(value.account_number, "Account number")}
                className="border-2 border-foreground"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleDob(value.id)}
                className="border-2 border-foreground"
              >
                {showDob[value.id] ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                DOB: {formatDob(value.date_of_birth, value.id)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Inline search component for forms
interface CustomerSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onCustomerSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export function CustomerSearchInput({
  value,
  onChange,
  onCustomerSelect,
  selectedCustomer,
  placeholder = "Enter account number (OCC...)",
  label = "Account Number",
  required = false,
}: CustomerSearchInputProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const lookupCustomer = useCallback(async (accountNumber: string) => {
    if (!accountNumber.trim()) {
      onCustomerSelect(null);
      return;
    }

    const normalized = accountNumber.trim().toUpperCase();
    if (!/^OCC\d{8}$/.test(normalized)) {
      return; // Wait for full account number
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_customer_search_view")
        .select("*")
        .eq("account_number", normalized)
        .single();

      if (error) {
        onCustomerSelect(null);
        if (error.code !== "PGRST116") {
          toast({ title: "Lookup failed", variant: "destructive" });
        }
        return;
      }

      onCustomerSelect(data as Customer);
    } catch (err) {
      console.error("Customer lookup error:", err);
      onCustomerSelect(null);
    } finally {
      setLoading(false);
    }
  }, [onCustomerSelect, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      lookupCustomer(value);
    }, 500);
    return () => clearTimeout(debounce);
  }, [value, lookupCustomer]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          className="font-mono border-2 border-foreground pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {selectedCustomer && (
        <div className="p-3 bg-primary/5 border-2 border-primary/20 rounded">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedCustomer.full_name || "Customer"}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {selectedCustomer.email}
          </div>
        </div>
      )}
      {value && !loading && !selectedCustomer && /^OCC\d{8}$/.test(value.trim().toUpperCase()) && (
        <p className="text-xs text-destructive">Customer not found</p>
      )}
    </div>
  );
}

export default CustomerPicker;
