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
import { Copy, Loader2, Search, User } from "lucide-react";
import { formatAccountNumber } from "@/lib/account";

const PAGE_SIZE = 10;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  created_at: string;
};

export const AdminCustomers = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");

  const queryKey = useMemo(() => ["admin-customers", search, page, filter], [search, page, filter]);

  const { data, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Build the base query on profiles table
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, phone, account_number, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Apply search filter
      if (search.trim()) {
        const searchTerm = search.trim();
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,account_number.ilike.%${searchTerm}%`
        );
      }

      // Apply filter for customers with open tickets
      if (filter === "open_tickets") {
        const { data: ticketUsers } = await supabase
          .from("support_tickets")
          .select("user_id")
          .in("status", ["open", "in_progress"]);
        const ids = ticketUsers?.map((ticket) => ticket.user_id) ?? [];
        if (!ids.length) {
          return { profiles: [] as Profile[], count: 0 };
        }
        query = query.in("id", ids);
      }

      const { data: profiles, error, count } = await query;
      if (error) throw error;
      return { profiles: (profiles || []) as Profile[], count: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  const handleCopyAccount = async (accountNumber?: string | null) => {
    if (!accountNumber) return;
    await navigator.clipboard.writeText(accountNumber);
    toast({ title: "Account number copied" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Customers</h1>
        <p className="text-muted-foreground">Filter, search, and open customer records.</p>
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or account number..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="pl-10 border-2 border-foreground"
            />
          </div>
          <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(0); }}>
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

      {error && (
        <Card className="border-2 border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Failed to load customers. Please try again.</p>
        </Card>
      )}

      <div className="grid gap-4">
        {data?.profiles?.map((profile) => {
          const accountNumber = formatAccountNumber(profile.account_number);
          const hasAccountNumber = accountNumber !== "—";
          return (
            <Card key={profile.id} className="border-2 border-foreground p-4 hover:bg-muted/50 transition-colors">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-display text-lg font-bold">{accountNumber}</div>
                      {hasAccountNumber && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyAccount(profile.account_number)}
                          aria-label="Copy account number"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="text-sm font-medium">{profile.full_name || "Unknown customer"}</div>
                    <div className="text-sm text-muted-foreground">{profile.email || "No email"}</div>
                    {profile.phone && (
                      <div className="text-xs text-muted-foreground">{profile.phone}</div>
                    )}
                  </div>
                </div>
                <Button asChild className="border-2 border-foreground">
                  <Link to={`/admin/customers/${profile.account_number || profile.id}`}>View details</Link>
                </Button>
              </div>
            </Card>
          );
        })}

        {isFetching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading customers...</span>
          </div>
        )}

        {!isFetching && !error && data?.profiles?.length === 0 && (
          <Card className="border-2 border-dashed border-foreground/40 p-8">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-display text-lg">No customers found</h3>
              <p className="text-sm text-muted-foreground">
                {search.trim() ? "Try adjusting your search terms." : "Customers will appear here once they sign up."}
              </p>
            </div>
          </Card>
        )}
      </div>

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
