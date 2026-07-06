import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Check, Download, Loader2, ShieldCheck } from "lucide-react";
import {
  CONTRACT_INFORMATION_PACK_TITLE,
  CONTRACT_SUMMARY_TITLE,
  CHECKBOX_TEXTS,
  DV_ACKNOWLEDGEMENT_CHECKBOX,
  DV_DEPENDENCY_POINTS,
  DV_VULNERABILITY_QUESTIONS,
} from "@/lib/legal/twoDocCopy";

interface ComponentRow {
  id: string; kind: string; label: string;
  monthly_price_incl_vat: number;
  contract_kind: string; minimum_term_months: number; notice_period_days: number;
  price_change: { kind: string; wording?: string };
  cancellation_wording: string;
  etf?: { wording?: string; worked_example?: string };
}

export default function TwoDocAcceptance() {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<any>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [addressOk, setAddressOk] = useState(false);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [c4, setC4] = useState(false);
  const [dvAck, setDvAck] = useState(false);
  const [dvAnswers, setDvAnswers] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<{ certificate_number: string | null; review: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-two-doc-bundle", { body: { token } });
        if (cancelled) return;
        if (error || (data as any)?.error) { setError((data as any)?.error ?? error?.message ?? "not_found"); return; }
        setBundle(data);
        const cs = (data as any).contract_summary;
        setName(cs.customer_name_snapshot ?? "");
        setEmail(cs.customer_email_snapshot ?? "");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const cs = bundle?.contract_summary;
  const pack = bundle?.contract_information_pack;
  const snapshot = cs?.body_snapshot;
  const components: ComponentRow[] = snapshot?.components ?? [];
  const dvPresent = useMemo(() => components.some((c) => c.kind === "digital_voice"), [components]);
  const alreadyAccepted = cs?.status === "accepted";

  const canSubmit =
    !!name && !!email && !!mobile && !!dob && addressOk &&
    c1 && c2 && c3 && c4 &&
    (!dvPresent || dvAck) &&
    !!bundle?.contract_summary_signed_url &&
    !!bundle?.contract_information_pack_signed_url;

  async function handleAccept() {
    if (!canSubmit) {
      toast({ title: "Please complete every field and download both documents.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-service-aware-cs", {
        body: {
          token,
          accepted_by_name: name,
          accepted_by_email: email,
          accepted_by_mobile: mobile,
          date_of_birth: dob,
          address_confirmed: true,
          checkbox_received_read: true,
          checkbox_details_correct: true,
          checkbox_understand_charges: true,
          checkbox_consent: true,
          cs_version: cs.version,
          cip_version: pack.version,
          digital_voice: dvPresent ? {
            acknowledged_dependencies: dvAck,
            relies_on_emergency: !!dvAnswers.relies_on_emergency,
            uses_telecare: !!dvAnswers.uses_telecare,
            uses_medical_equipment: !!dvAnswers.uses_medical_equipment,
            accessibility_needs: !!dvAnswers.accessibility_needs,
            poor_mobile_coverage: !!dvAnswers.poor_mobile_coverage,
          } : undefined,
          source_route: "/quote/two-doc",
        },
      });
      const r = data as any;
      if (error || r?.error) {
        const msg = r?.blocks ? r.blocks.map((b: any) => b.message).join("\n") : (r?.error ?? error?.message);
        toast({ title: "Acceptance blocked", description: msg, variant: "destructive" });
        return;
      }
      setAccepted({ certificate_number: r.certificate_number ?? null, review: !!r.vulnerability_review_required });
      toast({ title: "Contract accepted" });
    } catch (e) {
      toast({ title: "Unexpected error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <Layout><div className="container mx-auto p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></Layout>;
  }
  if (error || !bundle) {
    return (
      <Layout>
        <section className="container mx-auto p-12 max-w-xl text-center">
          <h1 className="font-display uppercase text-2xl">Contract not found</h1>
          <p className="text-sm text-muted-foreground mt-2">The link is invalid, expired, or the two-document flow is not enabled.</p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Accept Contract — OCCTA" description="Review and accept your OCCTA Contract Summary and Contract Information Pack." canonical={`/quote/two-doc/${token}`} noIndex />
      <section className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="border-4 border-foreground bg-background shadow-brutal mb-6 p-5">
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contract acceptance</p>
          <h1 className="font-display uppercase text-2xl md:text-3xl mt-1">{cs.plan_name}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            CS {cs.cs_number} v{cs.version} · Pack {pack?.cip_number ?? "—"} v{pack?.version ?? "—"} · Template v{snapshot?.template_version}
          </p>
        </div>

        {snapshot?.header_note && (
          <div className="border-4 border-foreground p-4 mb-5 text-sm bg-secondary/50">{snapshot.header_note}</div>
        )}

        <div className="border-4 border-foreground p-5 mb-5">
          <h2 className="font-display uppercase text-sm mb-3">Your service components</h2>
          <div className="space-y-4">
            {components.map((c) => (
              <div key={c.id} className="border-2 border-foreground p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display uppercase text-sm">{c.label}</p>
                  <p className="text-sm">£{Number(c.monthly_price_incl_vat).toFixed(2)}/mo</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.contract_kind === "fixed_term"
                    ? `Fixed term — ${c.minimum_term_months} months minimum`
                    : "Flex 30 — 30-day rolling"}
                  {" · "}Notice: {c.notice_period_days} days
                </p>
                <p className="text-xs mt-1">{c.cancellation_wording}</p>
                {c.etf?.wording && <p className="text-xs mt-1"><strong>ETF:</strong> {c.etf.wording}</p>}
                {c.price_change?.wording && <p className="text-xs mt-1"><strong>Price change:</strong> {c.price_change.wording}</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t-2 border-foreground flex items-baseline justify-between">
            <span className="font-display uppercase text-sm">Total monthly (incl. VAT where applicable)</span>
            <span className="font-display text-lg">£{Number(snapshot?.total_monthly_incl_vat ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="border-4 border-foreground p-5 mb-5 space-y-3">
          <h2 className="font-display uppercase text-sm">Your documents</h2>
          <a href={bundle.contract_summary_signed_url ?? "#"} target="_blank" rel="noreferrer"
             className="flex items-center justify-between border-2 border-foreground p-3 hover:bg-secondary">
            <span className="text-sm"><strong>{CONTRACT_SUMMARY_TITLE}</strong> — CS {cs.cs_number} v{cs.version}</span>
            <span className="inline-flex items-center gap-1 text-xs"><Download className="w-4 h-4" /> Download PDF</span>
          </a>
          <a href={bundle.contract_information_pack_signed_url ?? "#"} target="_blank" rel="noreferrer"
             className="flex items-center justify-between border-2 border-foreground p-3 hover:bg-secondary">
            <span className="text-sm"><strong>{CONTRACT_INFORMATION_PACK_TITLE}</strong> — {pack?.cip_number} v{pack?.version}</span>
            <span className="inline-flex items-center gap-1 text-xs"><Download className="w-4 h-4" /> Download PDF</span>
          </a>
          <p className="text-[11px] text-muted-foreground">Both documents are the immutable versions we'll archive when you accept. Links expire after 10 minutes; reload the page to refresh.</p>
        </div>

        {dvPresent && (
          <div className="border-4 border-destructive p-5 mb-5 bg-destructive/5">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <h2 className="font-display uppercase text-sm">Digital Voice — essential warnings</h2>
            </div>
            <ul className="text-xs space-y-1 mb-4 list-disc pl-5">
              {DV_DEPENDENCY_POINTS.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <label className="flex items-start gap-2 text-sm mb-4">
              <Checkbox checked={dvAck} onCheckedChange={(v) => setDvAck(v === true)} />
              <span>{DV_ACKNOWLEDGEMENT_CHECKBOX}</span>
            </label>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Please answer — your safety matters</p>
              {DV_VULNERABILITY_QUESTIONS.map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={!!dvAnswers[q.id]}
                    onCheckedChange={(v) => setDvAnswers((s) => ({ ...s, [q.id]: v === true }))}
                  />
                  <span>{q.label}</span>
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">
                If you tick any of the above, we'll pause activation for a safety check before your service goes live.
              </p>
            </div>
          </div>
        )}

        {!alreadyAccepted && !accepted && (
          <div className="border-4 border-primary p-5 space-y-4">
            <h2 className="font-display uppercase text-sm">Confirm and accept</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="tda-name">Full name</Label><Input id="tda-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="tda-email">Email (must match)</Label><Input id="tda-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label htmlFor="tda-mobile">Mobile</Label><Input id="tda-mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
              <div><Label htmlFor="tda-dob">Date of birth (18+)</Label><Input id="tda-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={addressOk} onCheckedChange={(v) => setAddressOk(v === true)} />
              <span>Service address <strong>{cs.service_address}</strong> is correct.</span>
            </label>

            <div className="space-y-2 pt-2 border-t-2 border-foreground/20">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={c1} onCheckedChange={(v) => setC1(v === true)} /><span>{CHECKBOX_TEXTS.received_read}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={c2} onCheckedChange={(v) => setC2(v === true)} /><span>{CHECKBOX_TEXTS.details_correct}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={c3} onCheckedChange={(v) => setC3(v === true)} /><span>{CHECKBOX_TEXTS.understand_charges}</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={c4} onCheckedChange={(v) => setC4(v === true)} /><span>{CHECKBOX_TEXTS.consent}</span>
              </label>
            </div>

            <Button variant="hero" className="w-full font-display uppercase" disabled={!canSubmit || submitting} onClick={handleAccept}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Accept both documents"}
            </Button>
          </div>
        )}

        {(alreadyAccepted || accepted) && (
          <div className="border-4 border-primary bg-primary/5 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Check className="w-6 h-6 text-primary" />
              <p className="font-display uppercase text-sm">Accepted</p>
            </div>
            {accepted?.certificate_number && (
              <p className="text-xs">Acceptance Certificate: <strong>{accepted.certificate_number}</strong></p>
            )}
            {accepted?.review && (
              <div className="mt-3 flex items-start gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Thanks — we've flagged a safety check for you. Activation will only proceed after our team confirms your Digital Voice setup is right for your circumstances. We'll be in touch shortly.</span>
              </div>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}