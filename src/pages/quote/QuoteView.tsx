import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_SUMMARY_PROMISE_TEXT } from "@/lib/legal/contractSummaryCopy";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuoteView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [csAvailable, setCsAvailable] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-quote-by-token", { body: { token } });
        if (cancelled) return;
        if (error || (data && (data as any).error)) {
          setError((data as any)?.error || error?.message || "not_found");
        } else {
          setQuote((data as any).quote);
          setCsAvailable(!!(data as any).contract_summary_available);
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const proceed = async () => {
    if (!token || proceeding) return;
    setProceeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-proceed-with-quote", { body: { token } });
      if (error || (data as any)?.ok === false) {
        toast({ title: "Couldn't record your choice", description: (data as any)?.reason ?? error?.message ?? "Please contact us.", variant: "destructive" });
      } else {
        setQuote((q: any) => ({ ...q, customer_intent_proceeded_at: (data as any)?.proceeded_at ?? new Date().toISOString() }));
        toast({ title: "Thanks — we'll prepare your Contract Summary", description: "We'll email you a secure link to review and accept before any payment." });
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setProceeding(false);
    }
  };

  if (loading) {
    return <Layout><div className="container mx-auto p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></Layout>;
  }
  if (error || !quote) {
    return <Layout><section className="container mx-auto p-12 max-w-xl text-center">
      <h1 className="font-display uppercase text-2xl mb-3">Quote not found</h1>
      <p className="text-sm text-muted-foreground">This quote link is invalid or has expired. Please contact <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>.</p>
    </section></Layout>;
  }

  const isBusiness = quote.customer_type === "business";
  const monthly = Number(quote.monthly_gross).toFixed(2);
  const monthlyNet = Number(quote.monthly_net).toFixed(2);
  const proceeded = !!quote.customer_intent_proceeded_at;
  const expired = quote.expires_at && new Date(quote.expires_at) < new Date();
  const eligible = ["approved","sent","viewed"].includes(quote.status) && !expired;
  const addons: any[] = Array.isArray(quote.selected_addons) ? quote.selected_addons : [];
  const hasDigitalVoice = addons.some((a: any) => {
    const s = JSON.stringify(a ?? "").toLowerCase();
    return s.includes("digital voice") || s.includes("digital_voice") || s.includes("voip");
  });

  return (
    <Layout>
      <SEO title={`Your OCCTA quote ${quote.quote_number}`} description="Your personalised OCCTA quote." canonical={`/quote/${token}`} />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">OCCTA · Quote {quote.quote_number}</p>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-1">{quote.plan_name}</h1>
        {(quote.customer_name || quote.service_postcode) && (
          <p className="text-sm text-muted-foreground mb-4">
            {quote.customer_name && <>Prepared for <strong className="text-foreground">{quote.customer_name}</strong></>}
            {quote.service_postcode && <> · Service postcode <span className="font-mono">{quote.service_postcode}</span></>}
          </p>
        )}

        <div className="border-2 border-foreground/20 bg-muted/40 p-3 mb-4 text-xs">
          <strong>No payment is taken at this stage.</strong> We'll send you a Contract Summary to review and accept before anything is charged.
        </div>

        <div className="border-4 border-foreground p-6 mb-6">
          <p className="font-display uppercase text-xs text-muted-foreground mb-2">Monthly price</p>
          {isBusiness ? (
            <>
              <p className="font-display text-4xl text-primary">£{monthlyNet}<span className="text-sm text-muted-foreground"> ex VAT</span></p>
              <p className="text-sm text-muted-foreground mt-1">£{monthly} incl VAT</p>
            </>
          ) : (
            <p className="font-display text-4xl text-primary">£{monthly}<span className="text-sm text-muted-foreground"> /month (incl VAT)</span></p>
          )}
          <p className="text-xs text-muted-foreground mt-3">{quote.plan_type === "flex" ? "30-day rolling" : `${quote.contract_length_months}-month term`} · {quote.notice_period} notice</p>
        </div>

        {Number(quote.total_due_today_gross) > 0 && (
          <div className="border-4 border-foreground p-6 mb-6">
            <p className="font-display uppercase text-xs text-muted-foreground mb-2">One-off charges</p>
            <ul className="text-sm space-y-1">
              {Number(quote.setup_gross) > 0 && <li className="flex justify-between"><span>Setup</span><span>£{Number(quote.setup_gross).toFixed(2)}</span></li>}
              {Number(quote.router_gross) > 0 && <li className="flex justify-between"><span>Router</span><span>£{Number(quote.router_gross).toFixed(2)}</span></li>}
              {Number(quote.delivery_gross) > 0 && <li className="flex justify-between"><span>Delivery</span><span>£{Number(quote.delivery_gross).toFixed(2)}</span></li>}
              {Number(quote.installation_gross) > 0 && <li className="flex justify-between"><span>Installation</span><span>£{Number(quote.installation_gross).toFixed(2)}</span></li>}
              <li className="flex justify-between border-t-2 border-foreground pt-2 mt-2 font-display uppercase"><span>Due today</span><span>£{Number(quote.total_due_today_gross).toFixed(2)}</span></li>
            </ul>
          </div>
        )}

        {(quote.estimated_download_speed || quote.estimated_upload_speed) && (
          <p className="text-sm text-muted-foreground mb-4">Estimated speeds: {quote.estimated_download_speed ?? "—"} Mbps down / {quote.estimated_upload_speed ?? "—"} Mbps up. {quote.speed_notes ?? ""}</p>
        )}

        {hasDigitalVoice && (
          <div className="border-2 border-warning bg-warning/10 p-3 mb-4 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span><strong>Digital Voice included.</strong> Digital Voice (VoIP) needs power and broadband to work. In a power cut you may not be able to call emergency services (999/112). We recommend keeping a charged mobile as backup. Vulnerable users may request a battery backup unit free of charge.</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-6">{CONTRACT_SUMMARY_PROMISE_TEXT}</p>

        {proceeded ? (
          <div className="border-4 border-primary bg-primary/5 p-6 flex gap-3 items-start">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-display uppercase mb-1">Thanks — we're on it</p>
              <p className="text-sm">We've recorded your choice to proceed. Your Contract Summary will arrive by email shortly. No payment has been taken.</p>
            </div>
          </div>
        ) : csAvailable ? (
          <div className="border-4 border-primary bg-primary/5 p-6">
            <p className="text-sm mb-4">Your Contract Summary is ready. Open the secure Contract Summary link sent to your email to review and accept before any payment.</p>
            <Link to="/support">
              <Button variant="outline" className="font-display uppercase">Can't find the email?</Button>
            </Link>
          </div>
        ) : eligible ? (
          <div className="border-4 border-foreground bg-background p-6">
            <p className="text-sm mb-4">Happy with this quote? Tap below and we'll prepare your Contract Summary.</p>
            <Button onClick={proceed} disabled={proceeding} variant="hero" size="lg" className="font-display uppercase w-full md:w-auto">
              {proceeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Proceed with this quote
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{expired ? "This quote has expired. Please contact us for a refresh." : "OCCTA is finalising your quote. You'll receive a secure link by email when it's ready."}</p>
        )}

        <p className="text-xs text-muted-foreground mt-8">Quote expires {new Date(quote.expires_at).toLocaleDateString("en-GB")}.</p>
      </section>
    </Layout>
  );
}