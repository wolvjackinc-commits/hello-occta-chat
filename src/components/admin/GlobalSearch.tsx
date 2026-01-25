import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  User,
  FileText,
  CreditCard,
  Building2,
  Ticket,
  ArrowRight,
  Mail,
  MapPin,
} from "lucide-react";
import { normalizePostcode } from "@/lib/utils";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  date_of_birth: string | null;
  latest_postcode: string | null;
};

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
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
        .limit(10);

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
      console.error("Global search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery && open) {
        searchCustomers(searchQuery);
      }
    }, 200);
    return () => clearTimeout(debounce);
  }, [searchQuery, open, searchCustomers]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setCustomers([]);
    }
  }, [open]);

  const handleCustomerAction = (customer: Customer, action: string) => {
    onOpenChange(false);
    const accountNumber = customer.account_number;
    
    switch (action) {
      case "view":
        navigate(`/admin/customers/${accountNumber}`);
        break;
      case "invoice":
        navigate(`/admin/billing?action=create&account=${accountNumber}`);
        break;
      case "payment":
        navigate(`/admin/payment-requests?action=create&account=${accountNumber}`);
        break;
      case "dd":
        navigate(`/admin/payment-requests?action=dd&account=${accountNumber}`);
        break;
      case "ticket":
        navigate(`/admin/tickets?action=create&account=${accountNumber}`);
        break;
      default:
        navigate(`/admin/customers/${accountNumber}`);
    }
  };

  const quickActions = [
    { label: "New Customers", icon: User, path: "/admin/customers" },
    { label: "Orders", icon: FileText, path: "/admin/orders" },
    { label: "Payment Requests", icon: CreditCard, path: "/admin/payment-requests" },
    { label: "DD Mandates", icon: Building2, path: "/admin/payments-dd" },
    { label: "Tickets", icon: Ticket, path: "/admin/tickets" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers by account, name, email, phone, or postcode..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching..." : searchQuery.length < 2 ? "Type to search..." : "No results found."}
        </CommandEmpty>

        {customers.length > 0 && (
          <CommandGroup heading="Customers">
            {customers.map((customer) => (
              <CommandItem
                key={customer.id}
                value={customer.id}
                onSelect={() => handleCustomerAction(customer, "view")}
                className="p-3"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {customer.account_number || "—"}
                      </Badge>
                      <span className="font-medium truncate">
                        {customer.full_name || "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
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
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {customers.length > 0 && searchQuery.length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions for Selected Customer">
              <CommandItem
                onSelect={() => customers[0] && handleCustomerAction(customers[0], "invoice")}
                className="pl-6"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice for {customers[0]?.account_number}
              </CommandItem>
              <CommandItem
                onSelect={() => customers[0] && handleCustomerAction(customers[0], "payment")}
                className="pl-6"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Send Payment Link to {customers[0]?.account_number}
              </CommandItem>
              <CommandItem
                onSelect={() => customers[0] && handleCustomerAction(customers[0], "dd")}
                className="pl-6"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Create DD Request for {customers[0]?.account_number}
              </CommandItem>
              <CommandItem
                onSelect={() => customers[0] && handleCustomerAction(customers[0], "ticket")}
                className="pl-6"
              >
                <Ticket className="w-4 h-4 mr-2" />
                Create Ticket for {customers[0]?.account_number}
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {!searchQuery && (
          <CommandGroup heading="Quick Navigation">
            {quickActions.map((action) => (
              <CommandItem
                key={action.path}
                onSelect={() => {
                  navigate(action.path);
                  onOpenChange(false);
                }}
              >
                <action.icon className="w-4 h-4 mr-2" />
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Hook to handle keyboard shortcut
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}

export default GlobalSearch;
