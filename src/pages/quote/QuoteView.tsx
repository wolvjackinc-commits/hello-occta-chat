import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_SUMMARY_PROMISE_TEXT } from "@/lib/legal/contractSummaryCopy";
import { Loader2 } from "lucide-react";

export default function QuoteView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [csAvailable, setCsAvailable] = useState(false);
  const [csToken, setCsToken] = useState<string | null>(null);

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

  // The CS token is held by the customer email; the quote view links to /quote/contract-summary/<their CS token>.
  // For Phase 2 we surface a button that asks the customer to use the CS link sent in their email.
  void setCsToken;

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

  return (
    <Layout>
      <SEO title={`Your OCCTA quote ${quote.quote_number}`} description="Your personalised OCCTA quote." canonical={`/quote/${token}`} />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quote {quote.quote_number}</p>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-4">{quote.plan_name}</h1>

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

        <p className="text-xs text-muted-foreground mb-6">{CONTRACT_SUMMARY_PROMISE_TEXT}</p>

        {csAvailable ? (
          <div className="border-4 border-primary bg-primary/5 p-6">
            <p className="text-sm mb-4">Your Contract Summary is ready. Open the secure Contract Summary link sent to your email to review and accept before any payment.</p>
            <Link to="/support">
              <Button variant="outline" className="font-display uppercase">Can't find the email?</Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">OCCTA is finalising your Contract Summary. You'll receive a secure link by email when it's ready.</p>
        )}

        <p className="text-xs text-muted-foreground mt-8">Quote expires {new Date(quote.expires_at).toLocaleDateString("en-GB")}.</p>
      </section>
    </Layout>
  );
}