import { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { receiptKey } from "@/lib/quoteSubmission";

interface QuoteThankYouState {
  bucketLabel?: string;
  termLabel?: string;
  routerLabel?: string;
  setupLabel?: string;
  addons?: string[];
  postcode?: string;
  monthlyEstimate?: number;
  firstBillEstimate?: number;
  email?: string;
}

export default function QuoteThankYou() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const { state } = useLocation();
  const s = (state ?? {}) as QuoteThankYouState;
  const hasDetails = !!(s.bucketLabel || s.termLabel || s.routerLabel || s.setupLabel || (s.addons && s.addons.length) || s.postcode);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session));
  }, []);
  const emailQS = s.email ? `&email=${encodeURIComponent(s.email)}` : "";
  const refQS = ref ? `&ref=${encodeURIComponent(ref)}` : "";
  const [verification, setVerification] = useState<'checking' | 'received' | 'unverified'>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setVerification('checking');
    const key = ref ? receiptKey(ref) : null;
    if (!key) { setVerification('unverified'); return; }
    void supabase.functions.invoke('quote-submission-status', { body: { submission_key: key } })
      .then(({ data, error }) => {
        if (!cancelled) setVerification(!error && data?.received && data.reference === ref ? 'received' : 'unverified');
      }).catch(() => { if (!cancelled) setVerification('unverified'); });
    return () => { cancelled = true; };
  }, [ref, attempt]);
  if (verification !== 'received') return <Layout>
    <SEO title="Check your quote request" description="Verify your OCCTA quote request." canonical="/quote/thank-you" />
    <section className="container mx-auto px-4 py-12 max-w-2xl space-y-4">
      <h1 className="font-display text-2xl">{verification === 'checking' ? 'Checking your request…' : 'We cannot verify this request from this page'}</h1>
      <p role="status">{verification === 'checking' ? 'Please wait while we check your saved receipt.' : 'Opening this page does not submit a quote. If you already submitted one, check your confirmation email or contact us with your reference. Please do not submit again solely because this page cannot verify it.'}</p>
      {ref && <p>Reference provided: {ref}</p>}
      {verification === 'unverified' && <button type="button" className="border-2 p-3" onClick={() => setAttempt((value) => value + 1)}>Check again</button>}
      <p><Link to="/quote/start" className="underline">Return to quote form</Link> · <Link to="/contact" className="underline">Contact OCCTA</Link></p>
    </section>
  </Layout>;
  return (
    <Layout>
      <SEO title="Quote request received" description="Thanks — OCCTA will check the best available option for your address." canonical="/quote/thank-you" />
      <section className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-6 border-4 border-foreground bg-primary text-primary-foreground flex items-center justify-center">
            <Check className="w-7 h-7" />
          </div>
          <h1 className="font-display uppercase text-3xl md:text-4xl mb-3">Thanks — we've got it.</h1>
          {ref && <p className="text-sm text-muted-foreground mb-2">Your reference: <strong className="font-mono">{ref}</strong></p>}
        </div>

        {hasDetails && (
          <div className="mt-8 border-4 border-foreground p-5">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Your selections</p>
            <dl className="text-sm space-y-2">
              {s.bucketLabel && <Row label="Speed" value={s.bucketLabel} />}
              {s.termLabel && <Row label="Plan type" value={s.termLabel} />}
              {s.routerLabel && <Row label="Router" value={s.routerLabel} />}
              {s.setupLabel && <Row label="Setup" value={s.setupLabel} />}
              {s.addons && s.addons.length > 0 && <Row label="Add-ons" value={s.addons.join(", ")} />}
              {s.postcode && <Row label="Postcode" value={s.postcode} />}
              {s.monthlyEstimate != null && (
                <div className="border-t-2 border-foreground/10 pt-2 mt-2">
                  <Row label="Estimated monthly" value={`£${s.monthlyEstimate.toFixed(2)}`} bold />
                </div>
              )}
              {s.firstBillEstimate != null && <Row label="Estimated first bill" value={`£${s.firstBillEstimate.toFixed(2)}`} bold />}
            </dl>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t-2 border-foreground/10">
              Estimate — final speed, setup and order details confirmed before you proceed.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">What happens next:</strong> OCCTA will check the best available option for your address and confirm speed, setup, switching details and the final price. You'll receive a Contract Summary to review before anything goes ahead.
          </p>
          <p>
            We'll be in touch by your preferred contact method.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {isAuthed ? (
            <>
              <Link to="/dashboard" className="font-display uppercase underline">View this quote in your dashboard</Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/" className="font-display uppercase underline">Back to home</Link>
            </>
          ) : (
            <div className="w-full">
              <div className="border-4 border-foreground p-4 bg-muted/30 mb-3">
                <p className="font-display uppercase text-sm mb-2">Track your quote in your OCCTA dashboard</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Use the same email address ({s.email ?? "the one you submitted"}) so we can link this quote to your account automatically.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/auth?mode=signup&link=qr${emailQS}${refQS}`}
                    className="inline-block border-4 border-foreground bg-primary text-primary-foreground px-4 py-2 font-display uppercase text-sm"
                  >
                    Create dashboard account
                  </Link>
                  <Link
                    to={`/auth?mode=signin&link=qr${emailQS}${refQS}`}
                    className="inline-block border-4 border-foreground bg-background px-4 py-2 font-display uppercase text-sm"
                  >
                    Sign in to dashboard
                  </Link>
                </div>
              </div>
              <Link to="/" className="font-display uppercase underline text-sm">Back to home</Link>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-display uppercase" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${bold ? "" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
