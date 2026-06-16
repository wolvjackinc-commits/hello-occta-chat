import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, ShieldCheck, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "./EmptyState";
import { logClientEvent } from "@/lib/activityLog";
import { useToast } from "@/hooks/use-toast";

type QuoteRow = {
  id: string;
  quote_number: string | null;
  plan_name: string | null;
  service_type: string | null;
  plan_type: string | null;
  customer_type: string | null;
  status: string;
  monthly_net: number | null;
  monthly_gross: number | null;
  total_due_today_gross: number | null;
  contract_length_months: number | null;
  expires_at: string | null;
  approved_at: string | null;
  created_at: string;
  quote_request_reference: string | null;
  customer_intent_proceeded_at: string | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted",
  sent: "bg-accent",
  viewed: "bg-warning",
  approved: "bg-primary text-primary-foreground",
  accepted: "bg-primary",
  expired: "bg-muted",
};

const statusLabel: Record<string, string> = {
  approved: "Final quote ready",
  sent: "Quote sent",
  viewed: "Quote viewed",
  accepted: "Quote accepted",
  expired: "Expired",
};

export function QuotesTab({ userId }: { userId: string }) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openQuote, setOpenQuote] = useState<any | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [proceedingId, setProceedingId] = useState<string | null>(null);
  const { toast } = useToast();

  const reload = async () => {
    const { data } = await (supabase as any).rpc("get_customer_quotes");
    setQuotes((data as QuoteRow[]) || []);
  };

  useEffect(() => {
    logClientEvent({ event_type: "tab_view", title: "dashboard:quotes", source_module: "dashboard" });
    (async () => { await reload(); setLoading(false); })();
  }, [userId]);

  const viewFinalQuote = async (id: string) => {
    setOpenLoading(true);
    setOpenQuote({ id });
    const { data, error } = await (supabase as any).rpc("get_customer_quote_by_id", { _id: id });
    setOpenLoading(false);
    if (error || !data?.[0]) {
      toast({ title: "Final quote not ready yet", variant: "destructive" });
      setOpenQuote(null);
      return;
    }
    setOpenQuote(data[0]);
  };

  const proceedWithQuote = async (id: string) => {
    setProceedingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("customer-proceed-with-quote", { body: { quote_id: id } });
      if (error || (data as any)?.ok === false) {
        toast({ title: "Couldn't record your choice", description: (data as any)?.reason ?? error?.message ?? "Please contact us.", variant: "destructive" });
      } else {
        toast({ title: "Thanks — we'll prepare your Contract Summary" });
        await reload();
        if (openQuote?.id === id) setOpenQuote({ ...openQuote, customer_intent_proceeded_at: new Date().toISOString() });
      }
    } finally {
      setProceedingId(null);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading quotes…</div>;
  if (quotes.length === 0) {
    return <EmptyState icon={<FileText className="w-8 h-8" />} title="Quote under review" message="A real person is reviewing your details. We'll email you when your final quote is ready — usually within one working day." />;
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-foreground/20 bg-muted/40 p-3 text-xs flex gap-2 items-start">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          <strong>No payment has been taken.</strong> A Contract Summary will be provided before you can order — nothing is final until you accept it.
        </span>
      </div>
      {quotes.map((q) => {
        const isBusiness = q.customer_type === "business";
        const expired = q.expires_at && new Date(q.expires_at) < new Date();
        const proceeded = !!q.customer_intent_proceeded_at;
        const label = proceeded ? "Proceeding" : (statusLabel[q.status] ?? q.status);
        const canProceed = !proceeded && !expired && ["approved","sent","viewed"].includes(q.status);
        const canView = ["approved","sent","viewed","accepted"].includes(q.status);
        return (
          <div key={q.id} className="border-4 border-foreground bg-background p-4 flex flex-col md:flex-row md:items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-display uppercase">{q.plan_name || "Quote"}</h4>
                <Badge className={`${proceeded ? "bg-primary text-primary-foreground" : statusColors[q.status] || "bg-muted"} border-2 border-foreground`}>{label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {q.quote_number ? `${q.quote_number} · ` : ""}
                {q.plan_type === "flex" ? "Flex 30" : (q.contract_length_months ? `Price Lock ${q.contract_length_months}` : q.plan_type)}
                {q.expires_at && ` · ${expired ? "Expired" : "Valid until"} ${format(new Date(q.expires_at), "dd MMM yyyy")}`}
              </p>
              {Number(q.total_due_today_gross || 0) > 0 && (
                <p className="text-xs mt-1">Estimated first bill: <strong>£{Number(q.total_due_today_gross).toFixed(2)}</strong> (incl. VAT)</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!canView} onClick={() => viewFinalQuote(q.id)} className="border-2 border-foreground">
                  <FileText className="w-3 h-3 mr-1" /> {canView ? "View final quote" : "Final quote not ready yet"}
                </Button>
                {canProceed && (
                  <Button size="sm" variant="hero" disabled={proceedingId === q.id} onClick={() => proceedWithQuote(q.id)}>
                    {proceedingId === q.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ArrowRight className="w-3 h-3 mr-1" />} Proceed with this quote
                  </Button>
                )}
                {proceeded && (
                  <span className="inline-flex items-center text-xs text-primary"><CheckCircle2 className="w-3 h-3 mr-1" /> Contract Summary coming next</span>
                )}
              </div>
            </div>
            <div className="text-right">
              {isBusiness ? (
                <>
                  <p className="font-display text-lg">£{Number(q.monthly_net || 0).toFixed(2)} <span className="text-xs">ex VAT</span></p>
                  <p className="text-xs text-muted-foreground">£{Number(q.monthly_gross || 0).toFixed(2)} incl VAT / mo</p>
                </>
              ) : (
                <p className="font-display text-lg">£{Number(q.monthly_gross || 0).toFixed(2)}<span className="text-xs">/mo (incl. VAT)</span></p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">Contract Summary will follow</p>
            </div>
          </div>
        );
      })}

      <Dialog open={!!openQuote} onOpenChange={(o) => !o && setOpenQuote(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openQuote?.plan_name ?? "Your OCCTA quote"}</DialogTitle>
          </DialogHeader>
          {openLoading || !openQuote?.quote_number ? (
            <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-4">
              <p className="font-mono text-xs text-muted-foreground">{openQuote.quote_number}</p>
              <div className="border-2 border-foreground p-4">
                <p className="text-xs uppercase text-muted-foreground">Monthly price</p>
                <p className="font-display text-3xl text-primary">£{Number(openQuote.monthly_gross || 0).toFixed(2)}<span className="text-sm text-muted-foreground"> /mo (incl. VAT)</span></p>
                <p className="text-xs text-muted-foreground mt-2">{openQuote.plan_type === "flex" ? "30-day rolling" : `${openQuote.contract_length_months}-month term`} · {openQuote.notice_period} notice</p>
              </div>
              {Number(openQuote.total_due_today_gross || 0) > 0 && (
                <div className="border-2 border-foreground p-4 text-sm space-y-1">
                  <p className="text-xs uppercase text-muted-foreground mb-2">One-off charges</p>
                  {Number(openQuote.setup_gross) > 0 && <div className="flex justify-between"><span>Setup</span><span>£{Number(openQuote.setup_gross).toFixed(2)}</span></div>}
                  {Number(openQuote.router_gross) > 0 && <div className="flex justify-between"><span>Router</span><span>£{Number(openQuote.router_gross).toFixed(2)}</span></div>}
                  {Number(openQuote.installation_gross) > 0 && <div className="flex justify-between"><span>Installation</span><span>£{Number(openQuote.installation_gross).toFixed(2)}</span></div>}
                  <div className="flex justify-between border-t-2 border-foreground pt-2 mt-2 font-display uppercase"><span>Due today</span><span>£{Number(openQuote.total_due_today_gross).toFixed(2)}</span></div>
                </div>
              )}
              {(openQuote.estimated_download_speed || openQuote.estimated_upload_speed) && (
                <p className="text-sm text-muted-foreground">Estimated speeds: {openQuote.estimated_download_speed ?? "—"} Mbps down / {openQuote.estimated_upload_speed ?? "—"} Mbps up.</p>
              )}
              <div className="text-xs border-2 border-foreground/20 bg-muted/40 p-3">
                <strong>No payment is taken at this stage.</strong> A Contract Summary will follow for you to review and accept.
              </div>
              {openQuote.customer_intent_proceeded_at ? (
                <div className="border-2 border-primary bg-primary/5 p-3 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" /> You've chosen to proceed. Contract Summary on its way.</div>
              ) : (["approved","sent","viewed"].includes(openQuote.status) && !(openQuote.expires_at && new Date(openQuote.expires_at) < new Date())) ? (
                <Button onClick={() => proceedWithQuote(openQuote.id)} disabled={proceedingId === openQuote.id} variant="hero" size="lg" className="w-full font-display uppercase">
                  {proceedingId === openQuote.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Proceed with this quote
                </Button>
              ) : null}
              {openQuote.expires_at && <p className="text-xs text-muted-foreground">Valid until {format(new Date(openQuote.expires_at), "dd MMM yyyy")}.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}