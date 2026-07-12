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
  Landmark,
  RefreshCw,
  Phone,
  XCircle,
  History,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/tabs/EmptyState";
import { DirectDebitStatus } from "@/components/dashboard/DirectDebitStatus";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";

type UpcomingInvoice = {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string | null;
  status: string;
};

type PaymentAttempt = {
  id: string;
  status: string;
  amount: number;
  reason: string | null;
  attempted_at: string;
  invoice_id: string | null;
};

// Common Bacs / Direct Debit failure codes with plain-English guidance.
// Keys are matched case-insensitively against the reason string.
const REASON_GUIDE: Record<string, { label: string; guidance: string }> = {
  "0": { label: "Refer to payer", guidance: "Your bank asked us to check with you first. Contact your bank, or update your details and we'll try again." },
  "1": { label: "Instruction cancelled", guidance: "The mandate was cancelled at your bank. Re-authorise a new Direct Debit to resume automatic collections." },
  "2": { label: "Payer deceased", guidance: "The account holder is recorded as deceased. Please contact us so we can update the account." },
  "3": { label: "Account transferred", guidance: "The account moved to another bank. Update your bank details and we'll re-collect." },
  "5": { label: "No account", guidance: "The account details don't match. Please double-check sort code and account number and update them." },
  "6": { label: "No instruction", guidance: "The mandate isn't recognised by your bank. Set the Direct Debit up again to continue." },
  "7": { label: "Amount differs", guidance: "The amount didn't match what was advised. We'll fix this and retry." },
  "8": { label: "Amount not yet due", guidance: "The collection was too early — we'll retry on the correct date." },
  "9": { label: "Account closed", guidance: "The bank account is closed. Provide new details to keep your service running." },
  insufficient_funds: { label: "Insufficient funds", guidance: "There wasn't enough in the account. Top up and we'll retry, or pay this invoice manually." },
  refer_to_payer: { label: "Refer to payer", guidance: "Your bank asked us to check with you first — please contact your bank or update details." },
  cancelled: { label: "Mandate cancelled", guidance: "Your Direct Debit was cancelled. Re-authorise to resume automatic collections." },
};

function reasonMeta(reason: string | null) {
  if (!reason) return null;
  const key = reason.trim().toLowerCase().replace(/\s+/g, "_");
  return REASON_GUIDE[key] ?? REASON_GUIDE[reason.trim()] ?? null;
}

export function DirectDebitOverview({ userId }: { userId: string }) {
  const [upcoming, setUpcoming] = useState<UpcomingInvoice[]>([]);
  const [failed, setFailed] = useState<PaymentAttempt[]>([]);
  const [recent, setRecent] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PaymentAttempt | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, f, r] = await Promise.all([
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
        supabase
          .from("payment_attempts")
          .select("id, status, amount, reason, attempted_at, invoice_id")
          .eq("user_id", userId)
          .order("attempted_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled) return;
      setUpcoming((u.data as UpcomingInvoice[]) || []);
      setFailed((f.data as PaymentAttempt[]) || []);
      setRecent((r.data as PaymentAttempt[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upcomingTotal = upcoming.reduce((s, i) => s + Number(i.total), 0);

  const isFailedStatus = (s: string) =>
    ["failed", "declined", "reversed", "returned"].includes(s.toLowerCase());
  const isSuccessStatus = (s: string) =>
    ["succeeded", "success", "paid", "captured", "cleared"].includes(s.toLowerCase());
  const mostRecentFailed = recent.find((a) => isFailedStatus(a.status));

  return (
    <div className="space-y-6">
      {/* Global next-step actions */}
      <div className="border-4 border-foreground bg-background p-4">
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="w-5 h-5" />
          <h3 className="font-display uppercase text-sm">Manage your Direct Debit</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Something changed with your bank? Update your details or talk to us — most fixes take under 5 minutes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/dd-setup">
            <Button variant="hero" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Update payment details
            </Button>
          </Link>
          <Link to="/support">
            <Button variant="outline" size="sm" className="border-2 border-foreground">
              <LifeBuoy className="w-4 h-4 mr-1" /> Contact support
            </Button>
          </Link>
          <a href={CONTACT_PHONE_TEL}>
            <Button variant="outline" size="sm" className="border-2 border-foreground">
              <Phone className="w-4 h-4 mr-1" /> Call {CONTACT_PHONE_DISPLAY}
            </Button>
          </a>
        </div>
      </div>

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
        {/* Last payment attempts */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display uppercase flex items-center gap-2">
              <History className="w-4 h-4" /> Last payment attempts
            </h3>
            {mostRecentFailed && (
              <Badge className="border-2 border-destructive bg-destructive/10 text-destructive">
                Action needed
              </Badge>
            )}
          </div>
          {loading ? (
            <div className="p-4 border-2 border-dashed border-foreground/30 text-sm text-muted-foreground">Loading…</div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8" />}
              title="No recent attempts"
              message="We haven't tried to take a payment yet."
            />
          ) : (
            <>
              {mostRecentFailed && (
                <div className="mb-2 p-3 border-2 border-destructive bg-destructive/5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs">
                    <strong>Most recent failed attempt:</strong>{" "}
                    £{Number(mostRecentFailed.amount).toFixed(2)} on{" "}
                    {format(new Date(mostRecentFailed.attempted_at), "dd MMM yyyy")} ·{" "}
                    {mostRecentFailed.reason || mostRecentFailed.status}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mostRecentFailed.invoice_id && (
                      <Link to={`/pay-invoice?id=${mostRecentFailed.invoice_id}`}>
                        <Button size="sm" variant="hero">Retry now</Button>
                      </Link>
                    )}
                    <Link to="/dd-setup">
                      <Button size="sm" variant="outline" className="border-2 border-foreground">
                        Update details
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <ul className="border-2 border-foreground/20 divide-y-2 divide-foreground/10 bg-background">
                {recent.map((a) => {
                  const failed = isFailedStatus(a.status);
                  const ok = isSuccessStatus(a.status);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setDetail(a)}
                        className="w-full text-left p-2 flex items-center gap-2 text-xs hover:bg-muted/40"
                      >
                      {failed ? (
                        <CircleAlert className="w-4 h-4 text-destructive flex-shrink-0" />
                      ) : ok ? (
                        <CircleCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">
                          <span className="font-display uppercase mr-2">{a.status.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(a.attempted_at), "dd MMM yyyy 'at' HH:mm")}
                            {a.reason ? ` · ${a.reason}` : ""}
                          </span>
                        </p>
                      </div>
                      <p className="font-display">£{Number(a.amount).toFixed(2)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

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
                  <Link to="/dd-setup">
                    <Button size="sm" variant="outline" className="border-2 border-foreground">
                      <RefreshCw className="w-4 h-4 mr-1" /> Update details
                    </Button>
                  </Link>
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

      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <DialogContent className="max-w-md border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">Payment attempt details</DialogTitle>
            <DialogDescription>
              Full record of this Direct Debit collection attempt.
            </DialogDescription>
          </DialogHeader>
          {detail && (() => {
            const meta = reasonMeta(detail.reason);
            const failedStatus = isFailedStatus(detail.status);
            const okStatus = isSuccessStatus(detail.status);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 border-2 border-foreground bg-background">
                    <p className="text-[10px] font-display uppercase text-muted-foreground">Amount</p>
                    <p className="font-display text-lg">£{Number(detail.amount).toFixed(2)}</p>
                  </div>
                  <div className="p-2 border-2 border-foreground bg-background">
                    <p className="text-[10px] font-display uppercase text-muted-foreground">Status</p>
                    <p className="font-display capitalize flex items-center gap-1">
                      {failedStatus ? <CircleAlert className="w-4 h-4 text-destructive" /> : okStatus ? <CircleCheck className="w-4 h-4 text-primary" /> : <Clock className="w-4 h-4" />}
                      {detail.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <div className="p-2 border-2 border-foreground/40 bg-muted/30 text-xs space-y-1">
                  <p><span className="font-display uppercase text-muted-foreground mr-1">Attempted:</span> {format(new Date(detail.attempted_at), "dd MMM yyyy 'at' HH:mm")}</p>
                  <p className="break-all"><span className="font-display uppercase text-muted-foreground mr-1">Reference:</span> {detail.id}</p>
                  {detail.invoice_id && (
                    <p className="break-all"><span className="font-display uppercase text-muted-foreground mr-1">Invoice ref:</span> {detail.invoice_id}</p>
                  )}
                  {detail.reason && (
                    <p><span className="font-display uppercase text-muted-foreground mr-1">Reason code:</span> {detail.reason}</p>
                  )}
                </div>
                {meta && (
                  <div className="p-3 border-2 border-foreground bg-warning/10">
                    <p className="font-display uppercase text-xs mb-1">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.guidance}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {failedStatus && detail.invoice_id && (
                    <Link to={`/pay-invoice?id=${detail.invoice_id}`} onClick={() => setDetail(null)}>
                      <Button size="sm" variant="hero">Retry payment</Button>
                    </Link>
                  )}
                  {failedStatus && (
                    <Link to="/dd-setup" onClick={() => setDetail(null)}>
                      <Button size="sm" variant="outline" className="border-2 border-foreground">
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Update details
                      </Button>
                    </Link>
                  )}
                  <Link to="/support" onClick={() => setDetail(null)}>
                    <Button size="sm" variant="outline" className="border-2 border-foreground">
                      <LifeBuoy className="w-3.5 h-3.5 mr-1" /> Contact support
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DirectDebitOverview;