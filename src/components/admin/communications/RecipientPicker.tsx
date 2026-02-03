import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";

interface RecipientPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

export const RecipientPicker = ({ selectedIds, onChange }: RecipientPickerProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-for-picker", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, account_number")
        .not("email", "is", null)
        .order("full_name")
        .limit(50);

      if (searchTerm.trim()) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,account_number.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Also fetch selected customers that might not be in the search results
  const { data: selectedCustomers = [] } = useQuery({
    queryKey: ["selected-customers", selectedIds],
    queryFn: async () => {
      if (selectedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_number")
        .in("id", selectedIds);

      if (error) throw error;
      return data as Customer[];
    },
    enabled: selectedIds.length > 0,
  });

  const handleToggle = (customerId: string) => {
    if (selectedIds.includes(customerId)) {
      onChange(selectedIds.filter((id) => id !== customerId));
    } else {
      onChange([...selectedIds, customerId]);
    }
  };

  const handleRemove = (customerId: string) => {
    onChange(selectedIds.filter((id) => id !== customerId));
  };

  // Merge selected customers with search results, avoiding duplicates
  const displayCustomers = [
    ...selectedCustomers.filter((c) => !customers.some((sc) => sc.id === c.id)),
    ...customers,
  ];

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCustomers.map((customer) => (
            <Badge
              key={customer.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {customer.full_name || customer.email}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-transparent"
                onClick={() => handleRemove(customer.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer list */}
      <ScrollArea className="h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : displayCustomers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {searchTerm ? "No customers found" : "Start typing to search"}
          </div>
        ) : (
          <div className="space-y-1">
            {displayCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={selectedIds.includes(customer.id)}
                  onCheckedChange={() => handleToggle(customer.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {customer.full_name || "No name"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {customer.email}
                    {customer.account_number && ` · ${customer.account_number}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
