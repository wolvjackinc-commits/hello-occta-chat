import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!token) return;
    journey2.completion(token)
      .then((r) => (r?.ok && r.completion ? setState(r.completion) : setError(r?.error ?? "not_completed")))
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

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-foreground/15 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-display uppercase text-sm text-right">{value}</dd>
    </div>
  );

  return (
    <Layout>
      <SEO title="Order confirmed | OCCTA" description="Your OCCTA order is confirmed." noIndex />
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        {state.test_session && (
          <p className="mb-4 border-4 border-foreground bg-foreground text-background p-3 font-display uppercase text-sm">
            Test order — no customer, billing, email or supplier action was created.
          </p>
        )}

        <div className="border-4 border-foreground p-6 mb-6">
          <CheckCircle2 className="w-8 h-8 mb-3" aria-hidden="true" />
          <h1 className="font-display uppercase text-3xl mb-1">Your order is confirmed</h1>
          <p className="text-sm text-muted-foreground">
            Order number <span className="font-display uppercase">{state.order_number}</span>
          </p>
        </div>

        <div className="border-4 border-foreground p-6 mb-6">
          <h2 className="font-display uppercase text-xl mb-3">What you ordered</h2>
          <dl>
            <Row label="Plan" value={state.plan_name ?? "—"} />
            <Row label="Monthly excluding VAT" value={money(state.monthly_ex_vat)} />
            <Row label={`VAT (${state.vat_rate_percent}%)`} value={money(state.monthly_vat)} />
            <Row label="Monthly including VAT" value={money(state.monthly_incl_vat)} />
            <Row label="One-off charges (billed on your first bill)" value={money(state.one_off_charges_incl_vat)} />
            <Row label="Due today" value={money(0)} />
            <Row label="Estimated first bill" value={money(state.estimated_first_bill_incl_vat)} />
          </dl>
          <p className="text-xs text-muted-foreground mt-3">
            Nothing is payable today. Setup, activation and any one-off router charge appear on your first bill.
          </p>
        </div>

        <div className="border-4 border-foreground p-6 mb-6">
          <h2 className="font-display uppercase text-xl mb-3">Start date &amp; payment</h2>
          <dl>
            <Row label="Preferred start date" value={state.preferred_start_date ?? "—"} />
            <Row label="Billing day" value={state.billing_anchor_day ? `${state.billing_anchor_day}` : "—"} />
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
            notice before any collection.
          </p>
        </div>

        <div className="border-4 border-foreground p-6 mb-6">
          <h2 className="font-display uppercase text-xl mb-3">Your documents</h2>
          <ul className="space-y-2">
            {state.documents.map((d) => (
              <li key={d.label} className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                {d.url
                  ? d.url.startsWith("/")
                    ? <Link className="underline" to={d.url}>{d.label}</Link>
                    : <a className="underline" href={d.url} target="_blank" rel="noreferrer">{d.label}</a>
                  : <span className="text-muted-foreground">{d.label} — being prepared</span>}
              </li>
            ))}
          </ul>
          {state.cooling_off_ends_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Your 14-day cooling-off period ends {new Date(state.cooling_off_ends_at).toLocaleDateString("en-GB")}.
            </p>
          )}
        </div>

        <div className="border-4 border-foreground p-6">
          <h2 className="font-display uppercase text-xl mb-3">Next steps</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            <li>We confirm your line and book your activation for your preferred date.</li>
            <li>Your Direct Debit mandate is set up with your bank — we'll confirm when it's active.</li>
            <li>Your welcome pack with every document lands in your inbox.</li>
            <li>Billing starts when your service goes live, on your chosen billing day.</li>
          </ol>
          <Button asChild className="mt-4 font-display uppercase"><Link to="/dashboard">Go to my account</Link></Button>
        </div>
      </section>
    </Layout>
  );
}
