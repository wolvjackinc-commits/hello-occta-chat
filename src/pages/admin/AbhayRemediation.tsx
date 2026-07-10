import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";

type PreviewPayload = {
  customer: {
    exists: boolean;
    id: string | null;
    account_number: string | null;
    full_name: string;
    email: string;
    phone: string;
    address_line1: string;
    city: string;
    postcode: string;
    will_be_created: boolean;
  };
  existing_service: {
    id: string | null;
    service_type: string;
    current_plan: string | null;
    current_price_monthly: number | null;
    billing_enabled: boolean;
    billing_anchor_day: number | null;
    will_be_created?: boolean;
  };
  legacy_snapshot: {
    legacy_monthly: number;
    latest_payment_date: string;
    latest_payment_amount: number;
    latest_payment_source: string;
    latest_payment_note: string;
  };
  new_plan: {
    plan_name: string;
    service_wording: string;
    monthly_net: number;
    monthly_vat: number;
    monthly_gross: number;
    vat_rate: number;
    plan_type: string;
    customer_type: string;
    contract_length_months: number | null;
    usage_wording: string;
  };
  billing: {
    anchor_day: number;
    effective_start_date: string;
    no_back_billing: boolean;
    july_double_charge_avoided: boolean;
    collection_blocked_until: string[];
  };
  already_remediated:
    | { quote_id: string; quote_number: string; status: string; created_at: string }
    | null;
  email_subject: string;
  email_html_preview: string;
};

type SendResult = {
  ok: true;
  action: "send";
  customer_id: string;
  account_number: string | null;
  customer_created: boolean;
  service_id: string;
  service_created: boolean;
  quote_id: string;
  quote_number: string;
  journey_url: string;
  billing_blocked: boolean;
};

export function AdminAbhayRemediation() {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-abhay-remediation", {
        body: { action: "preview" },
      });
      if (error) throw error;
      if (!data?.preview) throw new Error("No preview returned");
      setPreview(data.preview);
    } catch (e: any) {
      setError(e?.message || "Preview failed");
      toast.error("Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSend() {
    if (!preview) return;
    const isResend = !!preview.already_remediated;
    const parts: string[] = [];
    if (isResend) {
      parts.push(`RESEND EMAIL — reuse existing quote ${preview.already_remediated!.quote_number}, mint fresh journey token, re-email ${preview.customer.email}.`);
    } else {
      if (preview.customer.will_be_created) parts.push("• Create auth user + profile for Abhay Pratap Singh");
      if (preview.existing_service.will_be_created) parts.push("• Create broadband service (BTW FTTC 40/10, billing disabled)");
      parts.push(`• Create Contract Saver 24 quote (£${preview.new_plan.monthly_gross.toFixed(2)}/mo, 24 mo)`);
      parts.push(`• Block billing on service`);
      parts.push(`• Email ${preview.customer.email}`);
      parts.push("No invoice, no payment request, no receipt.");
    }
    const proceed = window.confirm(`${isResend ? "RESEND" : "FINAL CONFIRMATION"}\n\n${parts.join("\n")}\n\nContinue?`);
    if (!proceed) return;
    setSending(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-abhay-remediation", {
        body: { action: isResend ? "resend_email" : "send", confirm: true },
      });
      if (error) {
        let detail: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            detail = body?.details || body?.message || body?.error || null;
          }
        } catch { /* ignore */ }
        throw new Error(detail || error.message || "Send failed");
      }
      if (!data?.ok) throw new Error(data?.message || data?.error || "Send failed");
      setSent(data as SendResult);
      toast.success(isResend ? `Email resent — ${data.quote_number}` : `Agreement sent — ${data.quote_number}`);
    } catch (e: any) {
      setError(e?.message || "Send failed");
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-display uppercase tracking-tight">Abhay Legacy Broadband Renewal</h1>
        <p className="text-muted-foreground mt-2">
          One-shot flow scoped to <strong>abhayaghori@gmail.com</strong> — legacy BTW FTTC 40/10 broadband
          moved to <strong>Contract Saver 24</strong>. Preview first, then click send. If the customer/service don't
          exist, they will be created on send (idempotent).
        </p>
      </header>

      <Card className="p-6 border-2 border-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-yellow-600 shrink-0" />
          <div className="text-sm space-y-1">
            <p><strong>Guardrails.</strong> No invoice, no payment request, no receipt. No duplicate customer or service (looked up by email). Signed documents are not touched. Billing stays blocked until CS acceptance + DD mandate active.</p>
          </div>
        </div>
      </Card>

      {!preview && (
        <div className="flex gap-3">
          <Button onClick={loadPreview} disabled={loading} className="border-2 border-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading preview…</> : "Load preview"}
          </Button>
        </div>
      )}

      {error && (
        <Card className="p-4 border-2 border-destructive text-sm text-destructive">{error}</Card>
      )}

      {preview && (
        <>
          {preview.already_remediated && (
            <Card className="p-4 border-2 border-yellow-600 bg-yellow-50 text-sm">
              <strong>Already remediated:</strong> quote {preview.already_remediated.quote_number} (status {preview.already_remediated.status}, created {new Date(preview.already_remediated.created_at).toLocaleString()}). Use <em>Resend email</em> below to email fresh links — no duplicates will be created.
            </Card>
          )}

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Customer</h2>
            <Row label="Exists in DB" value={preview.customer.exists ? "Yes" : "NO — will be created on send"} highlight={!preview.customer.exists} />
            <Row label="Name" value={preview.customer.full_name} />
            <Row label="Email" value={preview.customer.email} highlight />
            <Row label="Phone" value={preview.customer.phone} />
            <Row label="Address" value={`${preview.customer.address_line1}, ${preview.customer.city}, ${preview.customer.postcode}`} />
            <Row label="Account number" value={preview.customer.account_number ?? "assigned on creation"} />
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Legacy snapshot</h2>
            <Row label="Legacy monthly" value={`£${preview.legacy_snapshot.legacy_monthly.toFixed(2)}`} />
            <Row label="Latest payment" value={`£${preview.legacy_snapshot.latest_payment_amount.toFixed(2)} on ${preview.legacy_snapshot.latest_payment_date}`} highlight />
            <Row label="Source" value={preview.legacy_snapshot.latest_payment_source} />
            <p className="text-xs text-muted-foreground pt-2 border-t">{preview.legacy_snapshot.latest_payment_note}</p>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Existing service</h2>
            {preview.existing_service.id ? (
              <>
                <Row label="Service ID" value={preview.existing_service.id} mono />
                <Row label="Type" value={preview.existing_service.service_type} />
                <Row label="Plan" value={preview.existing_service.current_plan} />
                <Row label="Current £/mo" value={fmt(preview.existing_service.current_price_monthly)} />
                <Row label="Billing enabled" value={String(preview.existing_service.billing_enabled)} />
                <Row label="Anchor day" value={String(preview.existing_service.billing_anchor_day)} />
              </>
            ) : (
              <>
                <Row label="Status" value="No service record — will be created on send" highlight />
                <Row label="Type" value={preview.existing_service.service_type} />
                <Row label="Plan wording" value={preview.existing_service.current_plan} />
                <Row label="Legacy £/mo" value={fmt(preview.existing_service.current_price_monthly)} />
              </>
            )}
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">New plan</h2>
            <Row label="Plan name" value={preview.new_plan.plan_name} highlight />
            <Row label="Service" value={preview.new_plan.service_wording} />
            <Row label="Net" value={fmt(preview.new_plan.monthly_net)} />
            <Row label={`VAT @ ${preview.new_plan.vat_rate}%`} value={fmt(preview.new_plan.monthly_vat)} />
            <Row label="Gross / month" value={fmt(preview.new_plan.monthly_gross)} highlight />
            <Row label="Plan type" value={preview.new_plan.plan_type} />
            <Row label="Contract length" value={`${preview.new_plan.contract_length_months} months`} />
            <p className="text-xs text-muted-foreground pt-2 border-t">{preview.new_plan.usage_wording}</p>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Billing</h2>
            <Row label="Anchor day" value={String(preview.billing.anchor_day)} />
            <Row label="Effective start" value={preview.billing.effective_start_date} highlight />
            <Row label="Back-billing" value={preview.billing.no_back_billing ? "No" : "Yes"} />
            <Row label="July double-charge avoided" value={preview.billing.july_double_charge_avoided ? "Yes" : "No"} />
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Collection blocked until all of:</div>
              <ul className="list-disc pl-5">
                {preview.billing.collection_blocked_until.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Email preview</h2>
            <Row label="To" value={preview.customer.email} />
            <Row label="Subject" value={preview.email_subject} />
            <details className="border-2 border-muted p-3">
              <summary className="cursor-pointer font-medium">Show rendered HTML preview</summary>
              <div className="mt-3 border border-muted-foreground/30 max-h-[500px] overflow-auto">
                <iframe title="Email preview" className="w-full h-[500px] bg-white" sandbox="" srcDoc={preview.email_html_preview} />
              </div>
            </details>
          </Card>

          <Card className="p-6 border-4 border-foreground bg-yellow-50">
            <h2 className="text-lg font-semibold uppercase tracking-wide mb-3">Send</h2>
            <p className="text-sm mb-4">
              This will {preview.customer.will_be_created ? "create the customer, " : ""}
              {preview.existing_service.will_be_created ? "create the service, " : ""}
              create the quote, block billing, and email the customer. Nothing has happened yet.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setPreview(null); setSent(null); }}
                className="border-2 border-foreground"
                disabled={sending}
              >
                Discard preview
              </Button>
              <Button
                onClick={confirmSend}
                disabled={sending || !!sent}
                className="border-2 border-foreground bg-foreground text-background hover:bg-foreground/90"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                ) : preview.already_remediated ? (
                  <><Mail className="w-4 h-4 mr-2" />Resend email (fresh links)</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" />Send agreement + DD setup</>
                )}
              </Button>
            </div>
          </Card>

          {sent && (
            <Card className="p-6 border-2 border-green-700 bg-green-50 space-y-2">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <strong>Sent</strong>
              </div>
              <Row label="Quote" value={sent.quote_number} highlight />
              <Row label="Quote ID" value={sent.quote_id} mono />
              <Row label="Customer ID" value={sent.customer_id} mono />
              <Row label="Account number" value={sent.account_number ?? "—"} />
              <Row label="Customer created" value={String(sent.customer_created)} />
              <Row label="Service ID" value={sent.service_id} mono />
              <Row label="Service created" value={String(sent.service_created)} />
              <Row label="Journey URL" value={sent.journey_url} mono />
              <Row label="Billing blocked" value={String(sent.billing_blocked)} />
              <p className="text-sm text-muted-foreground pt-2">The customer will now review the Contract Summary, e-sign, and enter Direct Debit bank details in the unified journey. Recurring billing stays off until the DD mandate is active.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string | null | undefined; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <div className="text-muted-foreground min-w-[180px]">{label}</div>
      <div className={`${highlight ? "font-bold" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `£${Number(n).toFixed(2)}`;
}

export default AdminAbhayRemediation;