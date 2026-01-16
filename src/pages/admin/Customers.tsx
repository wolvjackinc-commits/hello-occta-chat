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
import { Copy } from "lucide-react";

const PAGE_SIZE = 10;

export const AdminCustomers = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");

  const queryKey = useMemo(() => ["admin-customers", search, page, filter], [search, page, filter]);

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, phone, account_number, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,account_number.ilike.%${search}%`
        );
      }

      if (filter === "open_tickets") {
        const { data: ticketUsers } = await supabase
          .from("support_tickets")
          .select("user_id")
          .in("status", ["open", "in_progress"]);
        const ids = ticketUsers?.map((ticket) => ticket.user_id) ?? [];
        if (!ids.length) {
          return { profiles: [], count: 0 };
        }
        query = query.in("id", ids);
      }

      const { data: profiles, error, count } = await query;
      if (error) throw error;
      return { profiles, count: count ?? 0 };
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
          <Input
            placeholder="Search by name, email, account"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectItem value="open_tickets">With open tickets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-4">
        {data?.profiles?.map((profile) => (
          <Card key={profile.id} className="border-2 border-foreground p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg">{profile.account_number || "Account —"}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyAccount(profile.account_number)}
                    disabled={!profile.account_number}
                    aria-label="Copy account number"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">{profile.full_name || "Unknown customer"}</div>
                <div className="text-sm text-muted-foreground">{profile.email}</div>
              </div>
              <Button asChild>
                <Link to={`/admin/customers/${profile.id}`}>Open</Link>
              </Button>
            </div>
          </Card>
        ))}
        {isFetching && <p className="text-sm text-muted-foreground">Loading customers...</p>}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages || 1}
        </span>
        <Button
          variant="outline"
          disabled={page + 1 >= totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
