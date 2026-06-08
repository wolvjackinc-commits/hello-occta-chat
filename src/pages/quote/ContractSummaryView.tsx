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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-contract-summary-by-token", { body: { token } });
        if (cancelled) return;
        if (error || (data as any)?.error) setError((data as any)?.error || error?.message || "not_found");
        else {
          setCs((data as any).contract_summary);
          setEmail((data as any).contract_summary.customer_email_snapshot);
          setName((data as any).contract_summary.customer_name_snapshot);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (!confirm) { toast({ title: "Please tick the confirmation checkbox", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-contract-summary", {
        body: { token, accepted_by_name: name, accepted_by_email: email, checkbox_confirmed: true },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Contract Summary accepted" });
      navigate(`/quote/payment/${token}`);
    } catch (e) {
      toast({ title: "We couldn't record that", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (loading) return <Layout><div className="container mx-auto p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></Layout>;
  if (error || !cs) return <Layout><section className="container mx-auto p-12 max-w-xl text-center"><h1 className="font-display uppercase text-2xl">Contract Summary not found</h1><p className="text-sm text-muted-foreground mt-2">The link is invalid or has expired.</p></section></Layout>;

  const accepted = cs.status === "accepted";
  const isBusiness = cs.customer_type === "business";
  const oneOff = (cs.one_off_charges_json as Array<{label: string; amount: number}>) ?? [];

  return (
    <Layout>
      <SEO title={`Contract Summary ${cs.cs_number}`} description="OCCTA Contract Summary — review and accept before payment." canonical={`/quote/contract-summary/${token}`} />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contract Summary · {cs.cs_number} · v{cs.version}</p>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-4">{cs.plan_name}</h1>

        <div className="border-4 border-foreground p-5 mb-5">
          <h2 className="font-display uppercase text-sm mb-2">Customer & service</h2>
          <p className="text-sm">{cs.customer_name_snapshot} — {cs.customer_email_snapshot}</p>
          <p className="text-sm text-muted-foreground mt-1">{cs.service_address}</p>
        </div>

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

        {accepted ? (
          <div className="border-4 border-primary bg-primary/5 p-5 flex items-center gap-3">
            <Check className="w-6 h-6 text-primary" />
            <div>
              <p className="font-display uppercase text-sm">Accepted</p>
              <p className="text-xs text-muted-foreground">Accepted at {new Date(cs.accepted_at).toLocaleString("en-GB")}.</p>
            </div>
          </div>
        ) : (
          <div className="border-4 border-primary p-5">
            <h2 className="font-display uppercase text-sm mb-3">Confirm and accept</h2>
            <div className="space-y-3 mb-4">
              <div><Label htmlFor="cs-name">Your full name</Label><Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="cs-email">Your email (must match Contract Summary)</Label><Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
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