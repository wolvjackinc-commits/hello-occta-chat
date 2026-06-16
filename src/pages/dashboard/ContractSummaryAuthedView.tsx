import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTANCE_CHECKBOX_TEXT } from "@/lib/legal/contractSummaryCopy";
import { AlertTriangle, ArrowLeft, Check, Download, Loader2, Lock } from "lucide-react";

type CS = Awaited<ReturnType<typeof loadCs>>;
async function loadCs(csId: string) {
  const { data, error } = await supabase.rpc("get_customer_contract_summary_by_id", { _id: csId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export default function ContractSummaryAuthedView() {
  const { csId } = useParams<{ csId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cs, setCs] = useState<any | null>(null);
  const [acceptance, setAcceptance] = useState<any | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!csId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await loadCs(csId);
        if (cancelled) return;
        if (!row) { setCs(null); return; }
        setCs(row);
        const { data: acc } = await supabase.rpc("get_customer_contract_summary_acceptance", { _cs_id: csId });
        if (!cancelled) setAcceptance(Array.isArray(acc) ? acc[0] : acc);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [csId]);

  const downloadPdf = async () => {
    if (!csId) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", {
        body: { contract_summary_id: csId },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      const url = (data as any)?.signed_url;
      if (!url) throw new Error("no_signed_url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open PDF", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleAccept = async () => {
    if (!csId) return;
    if (!confirm) { toast({ title: "Please tick the confirmation checkbox", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-contract-summary-authed", {
        body: { contract_summary_id: csId, checkbox_confirmed: true },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      toast({ title: "Contract Summary accepted" });
      // Reload to show accepted state
      const fresh = await loadCs(csId);
      setCs(fresh);
      const { data: acc } = await supabase.rpc("get_customer_contract_summary_acceptance", { _cs_id: csId });
      setAcceptance(Array.isArray(acc) ? acc[0] : acc);
    } catch (e) {
      toast({ title: "We couldn't record that", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Layout><div className="container mx-auto p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></Layout>;
  }
  if (!cs) {
    return (
      <Layout>
        <section className="container mx-auto p-12 max-w-xl text-center">
          <h1 className="font-display uppercase text-2xl">Contract Summary not found</h1>
          <p className="text-sm text-muted-foreground mt-2">This Contract Summary isn't linked to your account, or it has been superseded.</p>
          <Link to="/dashboard"><Button className="mt-6" variant="outline">Back to dashboard</Button></Link>
        </section>
      </Layout>
    );
  }

  const accepted = cs.status === "accepted" || !!acceptance;
  const isBusiness = cs.customer_type === "business";
  const oneOff = (cs.one_off_charges_json as Array<{label:string;amount:number}> | null) ?? [];

  return (
    <Layout>
      <SEO title={`Contract Summary ${cs.cs_number}`} description="OCCTA Contract Summary — review, download and accept." canonical={`/dashboard/contract/${cs.id}`} />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to dashboard
        </button>

        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contract Summary · {cs.cs_number} · v{cs.version}</p>
        <h1 className="font-display uppercase text-3xl md:text-4xl mb-4">{cs.plan_name}</h1>

        <div className="flex gap-2 mb-4">
          <Button variant="outline" className="border-2 border-foreground" onClick={downloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Download PDF
          </Button>
          {accepted && <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest bg-primary/10 text-primary border-2 border-foreground px-3 py-2"><Lock className="w-3 h-3" /> Accepted — locked</span>}
        </div>

        <div className="border-4 border-foreground p-5 mb-5">
          <h2 className="font-display uppercase text-sm mb-2">Customer & service</h2>
          <p className="text-sm">{cs.customer_name_snapshot} — {cs.customer_email_snapshot}</p>
          {cs.account_number && <p className="text-xs text-muted-foreground">Account number: {cs.account_number}</p>}
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
              {oneOff.map((c, i) => <li key={i} className="flex justify-between"><span>{c.label}</span><span>£{Number(c.amount).toFixed(2)}</span></li>)}
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
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Complaints & ADR</h2>
          <p>{cs.complaints_adr_info}</p>
        </div>

        <div className="border-4 border-foreground p-5 mb-5 text-sm text-muted-foreground">
          <h2 className="font-display uppercase text-sm mb-2 text-foreground">Payment schedule</h2>
          <p>{cs.payment_schedule}</p>
        </div>

        {accepted ? (
          <div className="border-4 border-primary bg-primary/5 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Check className="w-6 h-6 text-primary" />
              <div>
                <p className="font-display uppercase text-sm">Accepted</p>
                <p className="text-xs text-muted-foreground">Accepted at {acceptance?.accepted_at ? new Date(acceptance.accepted_at).toLocaleString("en-GB") : (cs.accepted_at ? new Date(cs.accepted_at).toLocaleString("en-GB") : "")}.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">We'll contact you with payment and setup instructions. You don't need to do anything else right now.</p>
          </div>
        ) : (
          <div className="border-4 border-primary p-5">
            <h2 className="font-display uppercase text-sm mb-3">Confirm and accept</h2>
            <label className="flex items-start gap-2 text-sm mb-4">
              <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <span>{ACCEPTANCE_CHECKBOX_TEXT}</span>
            </label>
            <Button variant="hero" className="w-full font-display uppercase" disabled={submitting} onClick={handleAccept}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Accept Contract Summary"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">No payment is taken at this step. OCCTA will follow up with payment and setup instructions after acceptance.</p>
          </div>
        )}
      </section>
    </Layout>
  );
}