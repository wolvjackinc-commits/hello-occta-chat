import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import {
  Loader2, FileText, CheckCircle2, Check, Copy, Download, Gauge, MapPin, CalendarDays,
  Landmark, Mail, Phone, ShieldCheck, Sparkles, ArrowRight, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { journey2, money, type Journey2Completion } from "@/lib/journey2/client";
import { companyConfig } from "@/lib/companyConfig";

const TERM_LABEL: Record<string, string> = {
  flex_30: "Flex 30 — rolling monthly",
  price_lock_24: "Price Lock 24 — fixed 24 months",
};

const dateLong = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
};

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/**
 * Journey 2 completion. Read-only: opening this page never creates or changes
 * an order — the order was committed server-side before we got here.
 */
export default function OrderComplete() {
  const { token } = useParams();
  const [state, setState] = useState<Journey2Completion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    journey2.completion(token)
      .then((r) => {
        if (r?.ok && r.completion) {
          setState(r.completion);
          // Trigger Google Ads conversion tracking for the purchase
          if (!r.completion.test_session) {
            window.gtag?.('event', 'conversion', {
              'send_to': 'AW-18222446720/T6yqCJrD--IcEIDxkfFD',
              'value': r.completion.monthly_incl_vat,
              'currency': 'GBP',
              'transaction_id': r.completion.order_number
            });
          }
        } else {
          setError(r?.error ?? "not_completed");
        }
      })
      .catch(() => setError("network_error"));
  }, [token]);

  if (error) {
    return (
      <Layout>
        <SEO title="Order status | OCCTA" description="Your OCCTA order status." noIndex />
        <section className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="border-4 border-foreground p-6">
            <h1 className="font-display uppercase text-2xl mb-2">We can't show this order yet</h1>
            <p className="text-sm text-muted-foreground mb-4">
              This order isn't complete, or the link has expired. Nothing has been charged.
            </p>
            <Button asChild><Link to={`/order/${token}`}>Back to your order</Link></Button>
          </div>
        </section>
      </Layout>
    );
  }

  if (!state) {
    return (
      <Layout>
        <section className="container mx-auto px-4 py-24 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" aria-hidden="true" />
        </section>
      </Layout>
    );
  }

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-foreground/15 py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-right ${strong ? "font-display uppercase text-base" : "font-display uppercase text-sm"}`}>
        {value}
      </dd>
    </div>
  );

  const copyOrderNumber = async () => {
    if (!state.order_number) return;
    try {
      await navigator.clipboard.writeText(state.order_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const speeds =
    state.estimated_download_mbps && state.estimated_upload_mbps
      ? `${state.estimated_download_mbps} / ${state.estimated_upload_mbps} Mbps`
      : null;
  const addons = state.addons ?? [];
  const readyDocs = state.documents.filter((d) => !!d.url);

  return (
    <Layout>
      <SEO title="Order confirmed | OCCTA" description="Your OCCTA order is confirmed." noIndex />

      <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
        {state.test_session && (
          <p className="mb-6 border-4 border-foreground bg-foreground text-background p-3 font-display uppercase text-sm">
            Test order — no customer, billing, email or supplier action was created.
          </p>
        )}

        {/* Celebration header */}
        <div className="relative overflow-hidden border-4 border-foreground bg-primary text-primary-foreground p-7 md:p-10 mb-6 animate-scale-in">
          <div className="absolute -right-10 -top-10 w-44 h-44 border-4 border-primary-foreground/20 rotate-45" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4 font-display uppercase text-xs tracking-[0.2em]">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Welcome to OCCTA
            </div>
            <div className="w-14 h-14 border-4 border-primary-foreground flex items-center justify-center mb-5">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h1 className="font-display uppercase text-3xl md:text-5xl leading-[0.95] mb-3">
              {state.customer_name ? `Congratulations, ${state.customer_name.split(" ")[0]}!` : "Congratulations!"}
              <br />Your order is confirmed
            </h1>
            <p className="text-sm md:text-base opacity-90 max-w-xl mb-6">
              Everything is signed, sealed and in motion. Your plan is locked in at the price you agreed — no
              surprises, no small print games. {companyConfig.tagline}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="border-4 border-primary-foreground px-4 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Order number</div>
                <div className="font-display uppercase text-xl">{state.order_number}</div>
              </div>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="border-4 border-primary-foreground px-4 py-3 font-display uppercase text-xs inline-flex items-center gap-2 transition-colors hover:bg-primary-foreground hover:text-primary"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="border-4 border-primary-foreground px-4 py-3 font-display uppercase text-xs inline-flex items-center gap-2 transition-colors hover:bg-primary-foreground hover:text-primary print:hidden"
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Headline facts */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="border-4 border-foreground p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
              <CalendarDays className="w-4 h-4" aria-hidden="true" /> Preferred start
            </div>
            <div className="font-display uppercase text-lg leading-tight">{dateLong(state.preferred_start_date)}</div>
          </div>
          <div className="border-4 border-foreground p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
              <Gauge className="w-4 h-4" aria-hidden="true" /> Estimated speed
            </div>
            <div className="font-display uppercase text-lg leading-tight">{speeds ?? "Confirmed at activation"}</div>
          </div>
          <div className="border-4 border-foreground p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Due today
            </div>
            <div className="font-display uppercase text-lg leading-tight">{money(0)}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-6">
            <div className="border-4 border-foreground p-6">
              <h2 className="font-display uppercase text-xl mb-4">What you ordered</h2>
              <dl>
                <Row label="Plan" value={state.plan_name ?? "—"} strong />
                {state.contract_term && (
                  <Row label="Contract" value={TERM_LABEL[state.contract_term] ?? state.contract_term} />
                )}
                {typeof state.minimum_term_months === "number" && (
                  <Row
                    label="Minimum term"
                    value={state.minimum_term_months > 0 ? `${state.minimum_term_months} months` : "No minimum term"}
                  />
                )}
                {speeds && <Row label="Estimated speed (down / up)" value={speeds} />}
                {state.router_label && <Row label="Router" value={state.router_label} />}
                <Row label="Digital Voice" value={state.digital_voice_selected ? "Included" : "Not selected"} />
                {addons.length > 0 &&
                  addons.map((a) => <Row key={a.id} label={`Add-on — ${a.label}`} value={money(a.monthly)} />)}
              </dl>
              {state.speed_statement && (
                <p className="text-xs text-muted-foreground mt-3">{state.speed_statement}</p>
              )}
            </div>

            <div className="border-4 border-foreground p-6">
              <h2 className="font-display uppercase text-xl mb-4">Your price</h2>
              <dl>
                <Row label="Monthly excluding VAT" value={money(state.monthly_ex_vat)} />
                <Row label={`VAT (${state.vat_rate_percent}%)`} value={money(state.monthly_vat)} />
                <Row label="Monthly including VAT" value={money(state.monthly_incl_vat)} strong />
                <Row label="One-off charges (billed on your first bill)" value={money(state.one_off_charges_incl_vat)} />
                <Row label="Due today" value={money(0)} />
                <Row label="Estimated first bill" value={money(state.estimated_first_bill_incl_vat)} strong />
              </dl>
              <p className="text-xs text-muted-foreground mt-3">
                Nothing is payable today. Setup, activation and any one-off router charge appear on your first bill.
              </p>
            </div>

            <div className="border-4 border-foreground p-6">
              <h2 className="font-display uppercase text-xl mb-4">Service &amp; billing details</h2>
              <dl>
                {state.customer_name && <Row label="Account holder" value={state.customer_name} />}
                {state.customer_email && <Row label="Confirmation sent to" value={state.customer_email} />}
                {state.service_address && <Row label="Service address" value={state.service_address} />}
                {state.current_provider && <Row label="Switching from" value={state.current_provider} />}
                {state.number_action && (
                  <Row label="Phone number" value={state.number_action.replace(/_/g, " ")} />
                )}
                <Row
                  label="Billing day"
                  value={state.billing_anchor_day ? `${ordinal(state.billing_anchor_day)} of the month` : "—"}
                />
                <Row
                  label="Direct Debit"
                  value={state.dd_masked
                    ? `${state.dd_masked.bank_name} ••••${state.dd_masked.last4} (sort ••${state.dd_masked.sort_last2})`
                    : "—"}
                />
                <Row label="Direct Debit status" value={(state.dd_status ?? "pending").replace(/_/g, " ")} />
              </dl>
              <p className="text-xs text-muted-foreground mt-3">
                Your Direct Debit is only shown as active once your bank confirms the mandate. You always get advance
                notice before any collection, and billing starts only when your service goes live.
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border-4 border-foreground p-6">
              <h2 className="font-display uppercase text-xl mb-1">Your documents</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {readyDocs.length} of {state.documents.length} ready — the rest arrive by email shortly.
              </p>
              <ul className="space-y-2.5">
                {state.documents.map((d) => (
                  <li key={d.label} className="flex items-start gap-2 text-sm">
                    <FileText className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    {d.url
                      ? d.url.startsWith("/")
                        ? <Link className="underline underline-offset-4 hover:no-underline" to={d.url}>{d.label}</Link>
                        : (
                          <a
                            className="underline underline-offset-4 hover:no-underline inline-flex items-center gap-1"
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {d.label}
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        )
                      : <span className="text-muted-foreground">{d.label} — being prepared</span>}
                  </li>
                ))}
              </ul>
              {state.cooling_off_ends_at && (
                <p className="text-xs text-muted-foreground mt-4 border-t border-foreground/15 pt-3">
                  Your 14-day cooling-off period ends {dateLong(state.cooling_off_ends_at)}.
                </p>
              )}
            </div>

            <div className="border-4 border-foreground p-6">
              <h2 className="font-display uppercase text-xl mb-4">What happens next</h2>
              <ol className="space-y-4">
                {[
                  { t: "Line confirmed", d: "We confirm your line and book activation for your preferred date." },
                  { t: "Direct Debit set up", d: "Your mandate goes to your bank — we confirm when it's active." },
                  { t: "Welcome pack", d: "Every document lands in your inbox, ready to keep." },
                  { t: "Service live", d: "Billing starts when you go live, on your chosen billing day." },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-3">
                    <span className="shrink-0 w-8 h-8 border-4 border-foreground flex items-center justify-center font-display text-sm">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-display uppercase text-sm">{s.t}</span>
                      <span className="block text-sm text-muted-foreground">{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Button asChild className="mt-5 w-full font-display uppercase">
                <Link to="/dashboard">
                  Go to my account <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Sign in with {state.customer_email ?? "your order email"} to track every step.
              </p>
            </div>

            <div className="border-4 border-foreground bg-muted p-6">
              <h2 className="font-display uppercase text-xl mb-1">Need a hand?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Real people, {companyConfig.supportHours.phone}.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <a className="underline underline-offset-4" href={companyConfig.phone.href}>
                    {companyConfig.phone.display}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <a className="underline underline-offset-4" href={`mailto:${companyConfig.email.support}`}>
                    {companyConfig.email.support}
                  </a>
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {companyConfig.address.street}, {companyConfig.address.city}, {companyConfig.address.postcode}
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <Landmark className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  Quote your order number {state.order_number} and we'll find you instantly.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-8 break-all">
          Contract fingerprint {state.snapshot_sha256}
        </p>
      </section>
    </Layout>
  );
}
