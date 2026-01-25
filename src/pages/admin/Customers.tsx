import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, Loader2, MapPin, Search, User, Calendar } from "lucide-react";
import { formatAccountNumber } from "@/lib/account";
import { normalizePostcode } from "@/lib/utils";
import { format } from "date-fns";
import CustomerAdvancedSearch, {
  type AdvancedSearchFilters,
} from "@/components/admin/CustomerAdvancedSearch";

const PAGE_SIZE = 10;

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  date_of_birth: string | null;
  latest_postcode: string | null;
  latest_postcode_normalized: string | null;
  created_at: string;
};

const defaultFilters: AdvancedSearchFilters = {
  name: "",
  postcode: "",
  dob: undefined,
  matchMode: "all",
};

export const AdminCustomers = () => {
  const { toast } = useToast();
  const [quickSearch, setQuickSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [showDob, setShowDob] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedSearchFilters>(defaultFilters);

  const hasAdvancedFilters = appliedFilters.name || appliedFilters.postcode || appliedFilters.dob;

  const queryKey = useMemo(
    () => ["admin-customers", quickSearch, page, filter, appliedFilters],
    [quickSearch, page, filter, appliedFilters]
  );

  const { data, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Use the view for customer search
      let query = supabase
        .from("admin_customer_search_view")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Quick search (searches name, email, phone, account_number)
      if (quickSearch.trim() && !hasAdvancedFilters) {
        const term = quickSearch.trim();
        query = query.or(
          `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,account_number.ilike.%${term}%`
        );
      }

      // Advanced search filters
      if (hasAdvancedFilters) {
        const { name, postcode, dob, matchMode } = appliedFilters;

        if (matchMode === "all") {
          // AND logic - apply each filter sequentially
          if (name) {
            query = query.ilike("full_name", `%${name}%`);
          }
          if (postcode) {
            query = query.ilike("latest_postcode_normalized", `%${normalizePostcode(postcode)}%`);
          }
          if (dob) {
            query = query.eq("date_of_birth", format(dob, "yyyy-MM-dd"));
          }
        } else {
          // OR logic - build filter string
          const filters: string[] = [];
          if (name) {
            filters.push(`full_name.ilike.%${name}%`);
          }
          if (postcode) {
            filters.push(`latest_postcode_normalized.ilike.%${normalizePostcode(postcode)}%`);
          }
          if (dob) {
            filters.push(`date_of_birth.eq.${format(dob, "yyyy-MM-dd")}`);
          }
          if (filters.length > 0) {
            query = query.or(filters.join(","));
          }
        }
      }

      // Filter for customers with open tickets
      if (filter === "open_tickets") {
        const { data: ticketUsers } = await supabase
          .from("support_tickets")
          .select("user_id")
          .in("status", ["open", "in_progress"]);
        const ids = ticketUsers?.map((ticket) => ticket.user_id) ?? [];
        if (!ids.length) {
          return { customers: [] as CustomerRow[], count: 0 };
        }
        query = query.in("id", ids);
      }

      const { data: customers, error, count } = await query;
      if (error) throw error;
      return { customers: (customers || []) as CustomerRow[], count: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  const handleCopyAccount = async (accountNumber?: string | null) => {
    if (!accountNumber) return;
    await navigator.clipboard.writeText(accountNumber);
    toast({ title: "Account number copied" });
  };

  const handleAdvancedSearch = () => {
    setAppliedFilters(advancedFilters);
    setQuickSearch(""); // Clear quick search when using advanced
    setPage(0);
  };

  const handleClearAdvanced = () => {
    setAdvancedFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display">Customers</h1>
          <p className="text-muted-foreground">
            Search and manage customer records.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDob(!showDob)}
          className="flex items-center gap-1"
        >
          {showDob ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="text-xs">DOB</span>
        </Button>
      </div>

      {/* Quick Search + Filter Row */}
      <Card className="border-2 border-foreground p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Quick search: name, email, phone, account..."
              value={quickSearch}
              onChange={(event) => {
                setQuickSearch(event.target.value);
                setPage(0);
                // Clear advanced filters when using quick search
                if (event.target.value && hasAdvancedFilters) {
                  setAppliedFilters(defaultFilters);
                  setAdvancedFilters(defaultFilters);
                }
              }}
              className="pl-10 border-2 border-foreground"
              disabled={!!hasAdvancedFilters}
            />
          </div>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full md:w-56 border-2 border-foreground">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectItem value="open_tickets">With open tickets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Advanced Search Panel */}
      <CustomerAdvancedSearch
        filters={advancedFilters}
        onFiltersChange={setAdvancedFilters}
        onSearch={handleAdvancedSearch}
        onClear={handleClearAdvanced}
        isSearching={isFetching}
      />

      {/* Active Filters Indicator */}
      {hasAdvancedFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtering by:</span>
          {appliedFilters.name && (
            <span className="bg-secondary px-2 py-0.5 rounded">
              Name: "{appliedFilters.name}"
            </span>
          )}
          {appliedFilters.postcode && (
            <span className="bg-secondary px-2 py-0.5 rounded">
              Postcode: {appliedFilters.postcode}
            </span>
          )}
          {appliedFilters.dob && (
            <span className="bg-secondary px-2 py-0.5 rounded">
              DOB: {format(appliedFilters.dob, "dd/MM/yyyy")}
            </span>
          )}
          <span className="text-xs">
            ({appliedFilters.matchMode === "all" ? "Match ALL" : "Match ANY"})
          </span>
        </div>
      )}

      {error && (
        <Card className="border-2 border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load customers. Please try again.
          </p>
        </Card>
      )}

      {/* Results */}
      <div className="grid gap-4">
        {data?.customers?.map((customer) => {
          const accountNumber = formatAccountNumber(customer.account_number);
          const hasAccountNumber = accountNumber !== "—";
          return (
            <Card
              key={customer.id}
              className="border-2 border-foreground p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    {/* Account Number - Prominent */}
                    <div className="flex items-center gap-2">
                      <div className="font-display text-lg font-bold">
                        {accountNumber}
                      </div>
                      {hasAccountNumber && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyAccount(customer.account_number)}
                          aria-label="Copy account number"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* Name + Email */}
                    <div className="text-sm font-medium">
                      {customer.full_name || "Unknown customer"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {customer.email || "No email"}
                    </div>

                    {/* Extra info row: Phone, Postcode, DOB */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {customer.phone && <span>{customer.phone}</span>}
                      {customer.latest_postcode && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {customer.latest_postcode}
                        </span>
                      )}
                      {showDob && customer.date_of_birth && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(customer.date_of_birth), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button asChild className="border-2 border-foreground">
                  <Link
                    to={`/admin/customers/${customer.account_number || customer.id}`}
                  >
                    View details
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}

        {isFetching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading customers...
            </span>
          </div>
        )}

        {!isFetching && !error && data?.customers?.length === 0 && (
          <Card className="border-2 border-dashed border-foreground/40 p-8">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-display text-lg">No customers found</h3>
              <p className="text-sm text-muted-foreground">
                {quickSearch.trim() || hasAdvancedFilters
                  ? "Try adjusting your search terms."
                  : "Customers will appear here once they sign up."}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            className="border-2 border-foreground"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= totalPages || isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            className="border-2 border-foreground"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
