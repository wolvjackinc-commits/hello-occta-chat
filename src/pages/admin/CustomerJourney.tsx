import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminJourneyTimeline } from "@/components/admin/AdminJourneyTimeline";
import { JourneyInternalNotes } from "@/components/admin/JourneyInternalNotes";
import { normalizeAccountNumber, isAccountNumberValid } from "@/lib/account";

export default function AdminCustomerJourney() {
  const { accountNumber: raw } = useParams<{ accountNumber: string }>();
  const accountNumber = raw ? normalizeAccountNumber(raw) : null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-customer-journey", accountNumber],
    enabled: !!accountNumber && isAccountNumberValid(accountNumber),
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,account_number,email,full_name")
        .eq("account_number", accountNumber!)
        .maybeSingle();
      if (error || !profile) throw new Error("Customer not found");
      return profile;
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (isError || !data) return <div className="p-6 text-sm text-destructive">Customer not found.</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="border-2 border-foreground">
          <Link to={`/admin/customers/${data.account_number}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
        </Button>
        <h2 className="font-display uppercase text-xl">
          Journey · {data.full_name ?? data.email ?? ""} · {data.account_number}
        </h2>
      </div>

      <AdminJourneyTimeline customerId={data.id} />
      <JourneyInternalNotes customerId={data.id} />
    </div>
  );
}