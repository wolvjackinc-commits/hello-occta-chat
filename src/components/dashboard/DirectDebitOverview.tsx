import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  LifeBuoy,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/tabs/EmptyState";
import { DirectDebitStatus } from "@/components/dashboard/DirectDebitStatus";

type UpcomingInvoice = {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string | null;
  status: string;
};

type FailedAttempt = {
  id: string;
  status: string;
  amount: number;
  reason: string | null;
  attempted_at: string;
  invoice_id: string | null;
};

export function DirectDebitOverview({ userId }: { userId: string }) {
  const [upcoming, setUpcoming] = useState<UpcomingInvoice[]>([]);
  const [failed, setFailed] = useState<FailedAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, f] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, total, due_date, status")
          .eq("user_id", userId)
          .in("status", ["draft", "sent", "overdue"])
          .order("due_date", { ascending: true })
          .limit(6),
        supabase
          .from("payment_attempts")
          .select("id, status, amount, reason, attempted_at, invoice_id")
          .eq("user_id", userId)
          .in("status", ["failed", "declined", "reversed", "returned"])
          .order("attempted_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setUpcoming((u.data as UpcomingInvoice[]) || []);
      setFailed((f.data as FailedAttempt[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upcomingTotal = upcoming.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-6">
      {/* Mandate section (existing safe component) */}
      <DirectDebitStatus userId={userId} />

      {/* Upcoming payments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming payments
          </h3>
          {upcoming.length > 0 && (
            <Badge className="border-2 border-foreground bg-secondary text-foreground">
              £{upcomingTotal.toFixed(2)} · {upcoming.length}
            </Badge>
          )}
        </div>
        {loading ? (
          <div className="p-4 border-2 border-dashed border-foreground/30 text-sm text-muted-foreground">Loading…</div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8" />}
            title="Nothing scheduled"
            message="No upcoming invoices — you're all set."
          />
        ) : (
          <div className="space-y-2">
            {upcoming.map((inv) => {
              const overdue = inv.due_date && new Date(inv.due_date) < new Date();
              return (
                <div
                  key={inv.id}
                  className={`p-3 border-4 bg-background flex items-center justify-between gap-3 ${
                    overdue ? "border-destructive" : "border-foreground"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.due_date ? `Due ${format(new Date(inv.due_date), "dd MMM yyyy")}` : "Due date TBC"}
                      {overdue && " · Overdue"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-display">£{Number(inv.total).toFixed(2)}</p>
                    <Link to={`/pay-invoice?id=${inv.id}`}>
                      <Button size="sm" variant="outline" className="border-2 border-foreground">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Failed collections */}
      <section>
        <h3 className="font-display uppercase mb-3 flex items-center gap-2">
          <XCircle className="w-4 h-4" /> Failed collections
        </h3>
        {loading ? (
          <div className="p-4 border-2 border-dashed border-foreground/30 text-sm text-muted-foreground">Loading…</div>
        ) : failed.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-8 h-8" />}
            title="No failed payments"
            message="Every attempt has gone through cleanly."
          />
        ) : (
          <div className="space-y-2">
            {failed.map((a) => (
              <div key={a.id} className="p-3 border-4 border-destructive bg-destructive/5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="font-display uppercase">{a.status}</span>
                  </div>
                  <p className="font-display">£{Number(a.amount).toFixed(2)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(a.attempted_at), "dd MMM yyyy 'at' HH:mm")}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.invoice_id && (
                    <Link to={`/pay-invoice?id=${a.invoice_id}`}>
                      <Button size="sm" variant="hero">Retry payment</Button>
                    </Link>
                  )}
                  <Link to="/support">
                    <Button size="sm" variant="outline" className="border-2 border-foreground">
                      <LifeBuoy className="w-4 h-4 mr-1" /> Contact support
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="p-3 border-2 border-dashed border-foreground/30 bg-background text-xs text-muted-foreground flex items-start gap-2">
        <Clock className="w-4 h-4 mt-0.5" />
        <span>
          Direct Debit collections take 3-5 working days to clear. If a collection fails, we'll email you and pause any suspension until it's resolved.
        </span>
      </div>
    </div>
  );
}

export default DirectDebitOverview;