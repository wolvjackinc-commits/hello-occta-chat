import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { deriveMilestones, type JourneySafeInputs } from "@/lib/journey/milestones";
import { READINESS_STATUS_LABEL, SUPPLIER_LOCK_TAG, type ReadinessStatus } from "@/lib/provisioning/status";
import { CheckCircle2, Clock, Circle, AlertTriangle } from "lucide-react";

/**
 * Admin journey view. Shows fuller internal milestones and status flags
 * (webhook_verified, paid_at, readiness, draft order pack) but never exposes
 * raw webhook payloads, token hashes, or supplier cost/margin data.
 */
export function AdminJourneyTimeline({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    inputs: JourneySafeInputs;
    pr: any | null;
    readiness: any | null;
    packCount: number;
    events: Array<{ at: string; type: string }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [qrRes, qRes, csRes, caRes, prRes] = await Promise.all([
        supabase.from("quote_requests").select("id,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(1),
        supabase.from("quotes").select("id,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(1),
        supabase.from("contract_summaries").select("id,issued_at,pdf_sha256").eq("customer_id", customerId).order("issued_at", { ascending: false }).limit(1),
        supabase.from("contract_acceptances").select("id,accepted_at,pdf_sha256").eq("customer_id", customerId).order("accepted_at", { ascending: false }).limit(1),
        supabase.from("payment_requests").select("id,reference,status,webhook_verified,paid_at,created_at,amount,currency").eq("user_id", customerId).order("created_at", { ascending: false }).limit(1),
      ]);

      const pr = (prRes.data?.[0] as any) ?? null;

      const [readinessRes, packRes, eventsRes] = await Promise.all([
        pr ? (supabase as any).from("provisioning_readiness").select("status,updated_at").eq("payment_request_id", pr.id).maybeSingle() : Promise.resolve({ data: null }),
        pr ? (supabase as any).from("draft_order_packs").select("id", { count: "exact", head: true }).eq("payment_request_id", pr.id) : Promise.resolve({ count: 0 }),
        pr ? supabase.from("payment_request_events").select("created_at,event_type").eq("request_id", pr.id).order("created_at", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;

      const inputs: JourneySafeInputs = {
        quoteRequest: qrRes.data?.[0] ? { status: (qrRes.data[0] as any).status, created_at: (qrRes.data[0] as any).created_at } : null,
        quote: qRes.data?.[0] ? { status: (qRes.data[0] as any).status, created_at: (qRes.data[0] as any).created_at } : null,
        contractSummary: csRes.data?.[0] ? { issued_at: (csRes.data[0] as any).issued_at } : null,
        contractAccepted: caRes.data?.[0] ? { accepted_at: (caRes.data[0] as any).accepted_at } : null,
        paymentRequest: pr
          ? { status: pr.status, webhook_verified: pr.webhook_verified, paid_at: pr.paid_at, created_at: pr.created_at }
          : null,
        readinessStatus: (readinessRes as any)?.data?.status ?? null,
        hasDraftOrderPack: ((packRes as any)?.count ?? 0) > 0,
      };

      const events = (((eventsRes as any)?.data ?? []) as Array<{ created_at: string; event_type: string }>).map((e) => ({
        at: e.created_at,
        type: e.event_type,
      }));

      setData({
        inputs,
        pr,
        readiness: (readinessRes as any)?.data ?? null,
        packCount: (packRes as any)?.count ?? 0,
        events,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading admin journey…</div>;
  if (!data) return null;

  const milestones = deriveMilestones(data.inputs);
  const pr = data.pr;
  const webhookBlocked = pr && pr.status === "checkout_created" && !pr.webhook_verified;

  return (
    <div className="space-y-4">
      <div className="border-4 border-foreground bg-background p-4">
        <h3 className="font-display uppercase text-lg mb-3">Admin journey</h3>

        {webhookBlocked && (
          <div className="mb-3 p-2 border-2 border-foreground bg-muted/40 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>
              Phase E webhook sign-off pending — payment cannot progress past <strong>Payment being confirmed</strong> until a valid signed Worldpay webhook is received.
            </span>
          </div>
        )}

        <ol className="space-y-2">
          {milestones.map((m) => (
            <li key={m.key} className="flex items-start gap-2 text-sm">
              {m.state === "done" ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> : m.state === "current" ? <Clock className="w-4 h-4 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />}
              <div className="flex-1">
                <p className={m.state === "upcoming" ? "text-muted-foreground" : ""}>{m.label}</p>
                {m.at && <p className="text-[10px] uppercase text-muted-foreground">{format(new Date(m.at), "dd MMM yyyy HH:mm")}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {pr && (
        <div className="border-4 border-foreground bg-background p-4">
          <h4 className="font-display uppercase text-sm mb-2">Latest payment request</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div><span className="text-muted-foreground">Reference:</span> {pr.reference ?? "—"}</div>
            <div><span className="text-muted-foreground">Amount:</span> {pr.amount != null ? `${pr.currency ?? "GBP"} ${Number(pr.amount).toFixed(2)}` : "—"}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="border-2 border-foreground">{pr.status}</Badge></div>
            <div><span className="text-muted-foreground">webhook_verified:</span> <Badge variant="outline" className={`border-2 ${pr.webhook_verified ? "border-primary" : "border-foreground"}`}>{String(!!pr.webhook_verified)}</Badge></div>
            <div><span className="text-muted-foreground">paid_at:</span> {pr.paid_at ? format(new Date(pr.paid_at), "dd MMM yyyy HH:mm") : "—"}</div>
            <div><span className="text-muted-foreground">created_at:</span> {format(new Date(pr.created_at), "dd MMM yyyy HH:mm")}</div>
          </div>
          {data.events.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase font-display mb-1">Recent events</p>
              <ul className="text-xs space-y-1">
                {data.events.map((e, i) => (
                  <li key={i} className="flex justify-between border-b border-foreground/10 py-1">
                    <span>{e.type}</span>
                    <span className="text-muted-foreground">{format(new Date(e.at), "dd MMM HH:mm")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-4 border-foreground bg-background p-4">
        <h4 className="font-display uppercase text-sm mb-2">Readiness & supplier order</h4>
        <div className="text-xs space-y-1">
          <div>
            <span className="text-muted-foreground">Readiness state:</span>{" "}
            <Badge variant="outline" className="border-2 border-foreground">
              {data.readiness?.status
                ? READINESS_STATUS_LABEL[(data.readiness.status as ReadinessStatus)] ?? data.readiness.status
                : "awaiting verified payment"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Draft order packs:</span>{" "}
            <Badge variant="outline" className="border-2 border-foreground">{data.packCount}</Badge>
          </div>
          <div className="text-muted-foreground">{SUPPLIER_LOCK_TAG}</div>
        </div>
      </div>
    </div>
  );
}

export default AdminJourneyTimeline;