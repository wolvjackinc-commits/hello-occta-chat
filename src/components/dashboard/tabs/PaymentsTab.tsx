import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, Clock, CreditCard, FileText, Receipt as ReceiptIcon, XCircle } from "lucide-react";
import { EmptyState } from "./EmptyState";

type PR = {
  id: string;
  payment_request_number: string;
  status: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  failed_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  webhook_verified: boolean;
  contract_summary_id: string | null;
  cs_number?: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:            { label: "Draft",        cls: "bg-muted" },
  pending:          { label: "Awaiting payment", cls: "bg-warning" },
  sent:             { label: "Awaiting payment", cls: "bg-warning" },
  opened:           { label: "Awaiting payment", cls: "bg-warning" },
  checkout_created: { label: "Awaiting payment", cls: "bg-warning" },
  paid:             { label: "Paid",         cls: "bg-primary" },
  completed:        { label: "Paid",         cls: "bg-primary" },
  failed:           { label: "Failed",       cls: "bg-destructive" },
  cancelled:        { label: "Cancelled",    cls: "bg-muted" },
};

export function PaymentsTab({ userId }: { userId: string }) {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("id, payment_request_number, status, amount, currency, paid_at, failed_at, last_opened_at, created_at, webhook_verified, contract_summary_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as PR[];
      const csIds = Array.from(new Set(rows.map((r) => r.contract_summary_id).filter(Boolean) as string[]));
      const csMap: Record<string, string> = {};
      if (csIds.length > 0) {
        const { data: cs } = await supabase.from("contract_summaries").select("id,cs_number").in("id", csIds);
        (cs ?? []).forEach((c: any) => { csMap[c.id] = c.cs_number; });
      }
      setPrs(rows.map((r) => ({ ...r, cs_number: r.contract_summary_id ? csMap[r.contract_summary_id] : null })));
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading payments…</div>;
  if (prs.length === 0) {
    return <EmptyState icon={<CreditCard className="w-8 h-8" />} title="No payments yet" message="Your payment requests and receipts will appear here." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ReceiptIcon className="w-5 h-5" />
        <h3 className="font-display uppercase">Payments & Receipts</h3>
      </div>
      {prs.map((pr) => {
        const badge = STATUS_BADGE[pr.status] ?? { label: pr.status, cls: "bg-muted" };
        const isPaid = pr.status === "paid" || pr.status === "completed";
        const canPay = ["pending", "sent", "opened", "checkout_created"].includes(pr.status);
        return (
          <div key={pr.id} className="border-4 border-foreground bg-background p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm">{pr.payment_request_number}</span>
                  <Badge className={`${badge.cls} border-2 border-foreground`}>{badge.label}</Badge>
                  {isPaid && pr.webhook_verified && (
                    <Badge variant="outline" className="border-2 border-primary text-primary gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Created {format(new Date(pr.created_at), "dd MMM yyyy")}
                  {pr.cs_number && <> · Linked to <span className="font-mono">{pr.cs_number}</span></>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg">£{Number(pr.amount).toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{pr.currency}</div>
              </div>
            </div>

            {/* Timeline pills */}
            <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-widest">
              <Pill icon={<FileText className="w-3 h-3" />} label="Requested" active={true} at={pr.created_at} />
              <Pill icon={<Clock className="w-3 h-3" />} label="Opened" active={!!pr.last_opened_at} at={pr.last_opened_at} />
              {pr.status === "failed" || pr.status === "cancelled" ? (
                <Pill icon={<XCircle className="w-3 h-3" />} label={pr.status === "cancelled" ? "Cancelled" : "Failed"} active={true} at={pr.failed_at} variant="destructive" />
              ) : (
                <Pill icon={<CheckCircle2 className="w-3 h-3" />} label="Paid" active={isPaid} at={pr.paid_at} variant="primary" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isPaid && (
                <Link to={`/dashboard/receipt/${pr.id}`}>
                  <Button size="sm" variant="outline" className="border-2 border-foreground">
                    <ReceiptIcon className="w-4 h-4 mr-1" /> View receipt
                  </Button>
                </Link>
              )}
              {canPay && (
                <span className="text-xs text-muted-foreground flex items-center">Payment link sent by email</span>
              )}
              {pr.contract_summary_id && (
                <Link to={`/dashboard/contract/${pr.contract_summary_id}`}>
                  <Button size="sm" variant="ghost" className="border-2 border-transparent">
                    <FileText className="w-4 h-4 mr-1" /> Contract Summary
                  </Button>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pill({ icon, label, active, at, variant }: { icon: React.ReactNode; label: string; active: boolean; at: string | null; variant?: "primary" | "destructive" }) {
  const base = active
    ? variant === "destructive" ? "bg-destructive text-destructive-foreground border-foreground"
    : variant === "primary" ? "bg-primary text-primary-foreground border-foreground"
    : "bg-foreground text-background border-foreground"
    : "bg-background text-muted-foreground border-muted-foreground/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 border-2 ${base}`}>
      {icon}{label}{active && at ? ` · ${format(new Date(at), "dd MMM")}` : ""}
    </span>
  );
}