import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTANCE_CHECKBOX_TEXT } from "@/lib/legal/contractSummaryCopy";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import FullContractTermsBlock from "@/components/legal/FullContractTermsBlock";

type PackRow = { label: string; value: string };
type PackSection = {
  title: string;
  intro?: string;
  rows?: PackRow[];
  bullets?: string[];
  note?: string;
};
type PackAck = { key: string; text: string };
type PackSections = {
  sections?: PackSection[];
  acknowledgements?: PackAck[];
  business_name_label?: string;
  dd_setup_path?: string;
};

export default function ContractSummaryView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cs, setCs] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [packAcks, setPackAcks] = useState<Record<string, boolean>>({});
  const [ddPath, setDdPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-contract-summary-by-token", { body: { token } });
        if (cancelled) return;
        if (error || (data as any)?.error) setError((data as any)?.error || error?.message || "not_found");
        else {
          const summary = (data as any).contract_summary;
          setCs(summary);
          setEmail(summary.customer_email_snapshot);
          // When an authorised representative is signing, they must type
          // their own name rather than the account holder's.
          setName(summary.authorised_signatory_note ? "" : summary.customer_name_snapshot);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (!confirm) { toast({ title: "Please tick the confirmation checkbox", variant: "destructive" }); return; }
    const requiredAcks: PackAck[] = pack?.acknowledgements ?? [];
    const missing = requiredAcks.filter((a) => packAcks[a.key] !== true);
    if (missing.length) {
      toast({ title: "Please confirm every acknowledgement", description: `${missing.length} still to confirm.`, variant: "destructive" });
      return;
    }
    if (pack?.business_name_label && !businessName.trim()) {
      toast({ title: `${pack.business_name_label} is required`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-contract-summary", {
        body: {
          token,
          accepted_by_name: name,
          accepted_by_email: email,
          checkbox_confirmed: true,
          ...(requiredAcks.length ? { pack_acknowledgements: packAcks } : {}),
          ...(businessName.trim() ? { business_name: businessName.trim() } : {}),
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Contract Summary accepted" });
      if ((data as any)?.dd_setup_path) setDdPath(String((data as any).dd_setup_path));
      // Phase D: do NOT redirect to payment. Show in-place accepted state by reloading the CS view.
      const { data: fresh } = await supabase.functions.invoke("get-contract-summary-by-token", { body: { token } });
      if ((fresh as any)?.contract_summary) setCs((fresh as any).contract_summary);
    } catch (e) {
      toast({ title: "We couldn't record that", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) return <Layout><div className="container mx-auto p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></Layout>;
  if (error || !cs) return <Layout><section className="container mx-auto p-12 max-w-xl text-center"><h1 className="font-display uppercase text-2xl">Contract Summary not found</h1><p className="text-sm text-muted-foreground mt-2">The link is invalid or has expired.</p></section></Layout>;

  const accepted = cs.status === "accepted";
  const isBusiness = cs.customer_type === "business";
  const oneOff = (cs.one_off_charges_json as Array<{label: string; amount: number}>) ?? [];
  const pack = (cs.pack_sections ?? null) as PackSections | null;
  const packSections = pack?.sections ?? [];
  const packAckList = pack?.acknowledgements ?? [];
  const ddLink = ddPath ?? pack?.dd_setup_path ?? null;

  return (
    <Layout>
      <SEO title={`Contract Summary ${cs.cs_number}`} description="OCCTA Contract Summary — review and accept before payment." canonical={`/quote/contract-summary/${token}`} />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Branded header — OCCTA mark + Ofcom GC C1.3 framing */}
        <div className="border-4 border-foreground bg-background shadow-brutal mb-6">
          <div className="flex items-center gap-4 p-5 border-b-4 border-foreground bg-secondary">
            <div className="w-14 h-14 bg-primary border-4 border-foreground shadow-brutal flex items-center justify-center flex-shrink-0">
              <span className="font-display text-2xl text-primary-foreground">O</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-2xl tracking-tight leading-none">OCCTA</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                Telecom That Gets It
              </span>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contract Summary</p>
              <p className="font-display text-sm">{cs.cs_number} <span className="text-muted-foreground">· v{cs.version}</span></p>
            </div>
          </div>
          <div className="p-5">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your plan</p>
            <h1 className="font-display uppercase text-3xl md:text-4xl mt-1">{cs.plan_name}</h1>
            <p className="text-xs text-muted-foreground mt-3">
              Prepared in accordance with Ofcom General Condition C1.3 and the UK implementation of the European Electronic Communications Code. Issued by OCCTA LIMITED, registered in England &amp; Wales.
            </p>
          </div>
        </div>

        <div className="border-4 border-foreground p-5 mb-5">
          <h2 className="font-display uppercase text-sm mb-2">Customer & service</h2>
          <p className="text-sm">{cs.customer_name_snapshot} — {cs.customer_email_snapshot}</p>
          <p className="text-sm text-muted-foreground mt-1">{cs.service_address}</p>
        </div>

        {cs.authorised_signatory_note && (
          <div className="border-4 border-primary p-5 mb-5">
            <h2 className="font-display uppercase text-sm mb-2">Signing as authorised representative</h2>
            <p className="text-sm">{cs.authorised_signatory_note}</p>
          </div>
        )}

        <div className="border-4 border-foreground p-5 mb-5">
          <h2 className="font-display uppercase text-sm mb-2">Price</h2>
          {isBusiness ? (
            <>
              <p className="text-sm">Monthly (ex VAT): <strong>£{Number(cs.business_monthly_ex_vat ?? 0).toFixed(2)}</strong></p>
              <p className="text-sm">Monthly (incl VAT): <strong>£{Number(cs.business_monthly_incl_vat ?? 0).toFixed(2)}</strong></p>
            </>
          ) : (
            <p className="text-sm">Monthly (incl VAT): <strong>£{Number(cs.monthly_price_incl_vat).toFixed(2)}</strong></p>
          )}
          {oneOff.length > 0 && (
            <ul className="text-sm mt-3 space-y-1">
              {oneOff.map((c, idx) => <li key={idx} className="flex justify-between"><span>{c.label}</span><span>£{Number(c.amount).toFixed(2)}</span></li>)}
            </ul>
          )}
        </div>

        <div className="border-4 border-foreground p-5 mb-5 grid sm:grid-cols-2 gap-3 text-sm">
          <div><strong>Contract length:</strong> {cs.contract_length}</div>
          <div><strong>Notice period:</strong> {cs.notice_period}</div>
          <div><strong>Estimated download:</strong> {cs.estimated_download_speed ?? "—"} Mbps</div>
          <div><strong>Estimated upload:</strong> {cs.estimated_upload_speed ?? "—"} Mbps</div>
        </div>

        {cs.speed_notes && <p className="text-xs text-muted-foreground mb-4">{cs.speed_notes}</p>}

        <div className="border-4 border-foreground p-5 mb-5 text-sm">
          <h2 className="font-display uppercase text-sm mb-2">Cease / cancellation</h2>
          <p className="text-muted-foreground">{cs.cease_cancellation_charges}</p>
        </div>

        <div className="border-4 border-foreground p-5 mb-5 text-sm text-muted-foreground">
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Price rises</h2>
          <p>{cs.price_rise_policy}</p>
        </div>

        {cs.digital_voice_warning && (
          <div className="border-4 border-destructive p-5 mb-5 bg-destructive/5 text-sm">
            <div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div><h2 className="font-display uppercase text-sm mb-1">Digital Voice — important</h2><p>{cs.digital_voice_warning}</p></div>
            </div>
          </div>
        )}

        <div className="border-4 border-foreground p-5 mb-5 text-sm text-muted-foreground">
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Vulnerable customers</h2>
          <p>{cs.vulnerable_customer_note}</p>
        </div>

        <div className="border-4 border-foreground p-5 mb-5 text-sm text-muted-foreground">
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Complaints & ADR</h2>
          <p>{cs.complaints_adr_info}</p>
        </div>

        <div className="border-4 border-foreground p-5 mb-5 text-sm text-muted-foreground">
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Payment schedule</h2>
          <p>{cs.payment_schedule}</p>
        </div>

        {packSections.map((s, idx) => (
          <div key={idx} className="border-4 border-foreground p-5 mb-5 text-sm">
            <h2 className="font-display uppercase text-sm mb-2">{s.title}</h2>
            {s.intro && <p className="text-muted-foreground mb-3 whitespace-pre-line">{s.intro}</p>}
            {s.rows && s.rows.length > 0 && (
              <ul className="space-y-1 mb-3">
                {s.rows.map((r, ri) => (
                  <li key={ri} className="flex justify-between gap-4 border-b border-border pb-1">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium text-right">{r.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.bullets && s.bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {s.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
              </ul>
            )}
            {s.note && <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">{s.note}</p>}
          </div>
        ))}

        <div className="mb-5">
          <FullContractTermsBlock collapsibleHeading={false} />
        </div>

        {accepted ? (
          <div className="border-4 border-primary bg-primary/5 p-5">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-primary" />
              <div>
                <p className="font-display uppercase text-sm">Accepted</p>
                <p className="text-xs text-muted-foreground">Accepted at {new Date(cs.accepted_at).toLocaleString("en-GB")}.</p>
              </div>
            </div>
            {ddLink && (
              <div className="mt-4 border-t-4 border-primary pt-4">
                <p className="font-display uppercase text-sm mb-1">Next step — set up your Direct Debit</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Complete your Direct Debit Instruction so we can collect your first payment and place the order.
                </p>
                <Button variant="hero" className="w-full font-display uppercase" onClick={() => navigate(ddLink)}>
                  Set up Direct Debit
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-4 border-primary p-5">
            <h2 className="font-display uppercase text-sm mb-3">Confirm and accept</h2>
            <div className="space-y-3 mb-4">
              <div>
                <Label htmlFor="cs-name">
                  {cs.authorised_signatory_note
                    ? "Your full name (the authorised representative signing this agreement)"
                    : "Your full name"}
                </Label>
                <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div><Label htmlFor="cs-email">Your email (must match Contract Summary)</Label><Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {pack?.business_name_label && (
                <div>
                  <Label htmlFor="cs-business">{pack.business_name_label}</Label>
                  <Input id="cs-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
              )}
            </div>
            {packAckList.length > 0 && (
              <div className="border-4 border-foreground p-4 mb-4 space-y-3">
                <h3 className="font-display uppercase text-xs">Your acknowledgements</h3>
                {packAckList.map((a) => (
                  <label key={a.key} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={packAcks[a.key] === true}
                      onCheckedChange={(v) => setPackAcks((prev) => ({ ...prev, [a.key]: v === true }))}
                    />
                    <span>{a.text}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-start gap-2 text-sm mb-4">
              <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <span>{ACCEPTANCE_CHECKBOX_TEXT}</span>
            </label>
            <Button variant="hero" className="w-full font-display uppercase" disabled={submitting} onClick={handleAccept}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Accept Contract Summary"}
            </Button>
          </div>
        )}
      </section>
    </Layout>
  );
}