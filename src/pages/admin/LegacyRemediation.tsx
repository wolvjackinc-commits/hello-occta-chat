import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";

// Locked to the specific legacy customer this remediation was designed for.
const CUSTOMER_ID = "8962f90e-b142-4582-b1dc-14d372894691"; // Dullabhbhai Mistry — OCC70547490

type PreviewPayload = {
  customer: { id: string; account_number: string; full_name: string | null; profile_email: string };
  recipient_email: string;
  existing_service: {
    id: string;
    service_type: string;
    current_plan: string | null;
    current_price_monthly: number | null;
    billing_enabled: boolean;
    billing_anchor_day: number | null;
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
    collection_blocked_until: string[];
  };
  already_remediated:
    | { quote_id: string; quote_number: string; status: string; created_at: string }
    | null;
  legacy_invoice: {
    period_start: string;
    period_end: string;
    subtotal: number;
    vat_total: number;
    total: number;
    vat_treatment: string;
    lines: Array<{ description: string; net: number; vat_rate: number }>;
    already_created: {
      id: string;
      invoice_number: string;
      status: string;
      issue_date: string;
      due_date: string | null;
      total: number;
      payment_request_number: string | null;
      payment_request_status: string | null;
    } | null;
  };
  email_subject: string;
  email_html_preview: string;
};

type SendResult = {
  ok: true;
  action: "send";
  quote_id: string;
  quote_number: string;
  journey_url: string;
  service_id: string;
  billing_blocked: boolean;
  legacy_invoice_id: string | null;
  legacy_invoice_number: string | null;
  legacy_invoice_pay_url: string | null;
};

export function AdminLegacyRemediation() {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-legacy-remediation", {
        body: { action: "preview", customer_id: CUSTOMER_ID },
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
    const proceed = window.confirm(
      isResend
        ? `RESEND EMAIL\n\nThis will:\n• Reuse existing quote ${preview.already_remediated!.quote_number}\n• Mint fresh journey + payment tokens (old links will stop working)\n• Re-email ${preview.recipient_email}\n\nNo new quote, invoice, or payment request will be created.\n\nContinue?`
        : `FINAL CONFIRMATION\n\nThis will:\n• Create quote for ${preview.customer.full_name} (${preview.customer.account_number})\n• Block billing on existing service ${preview.existing_service.id}\n• Email ${preview.recipient_email} with the secure agreement + DD link\n\nContinue?`,
    );
    if (!proceed) return;
    setSending(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-legacy-remediation", {
        body: { action: isResend ? "resend_email" : "send", customer_id: CUSTOMER_ID, confirm: true },
      });
      if (error) {
        // FunctionsHttpError doesn't expose the response body by default.
        // Try to read it so we can show the real server-side reason.
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
        <h1 className="text-3xl font-display uppercase tracking-tight">Legacy Contract Remediation</h1>
        <p className="text-muted-foreground mt-2">
          One-shot flow: preview everything, then click send once. Scoped to account <strong>OCC70547490</strong>.
          Nothing is written until you click <em>Send agreement + DD setup</em>.
        </p>
      </header>

      <Card className="p-6 border-2 border-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-yellow-600 shrink-0" />
          <div className="text-sm space-y-1">
            <p><strong>Guardrails.</strong> No invoice, no payment request, no receipt. Existing service is reused (no duplicate). Signed CS PDFs are not touched. Billing is blocked until CS acceptance + DD mandate active.</p>
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
        <Card className="p-4 border-2 border-destructive text-sm text-destructive">
          {error}
        </Card>
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
            <Row label="Name" value={preview.customer.full_name} />
            <Row label="Account" value={preview.customer.account_number} />
            <Row label="Profile email" value={preview.customer.profile_email} />
            <Row label="Recipient (daughter/contact)" value={preview.recipient_email} highlight />
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Existing service (will be reused)</h2>
            <Row label="Service ID" value={preview.existing_service.id} mono />
            <Row label="Current type" value={preview.existing_service.service_type} />
            <Row label="Current plan" value={preview.existing_service.current_plan} />
            <Row label="Current £/mo" value={fmt(preview.existing_service.current_price_monthly)} />
            <Row label="Billing enabled now" value={String(preview.existing_service.billing_enabled)} />
            <Row label="Current anchor day" value={String(preview.existing_service.billing_anchor_day)} />
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">New plan</h2>
            <Row label="Plan name" value={preview.new_plan.plan_name} highlight />
            <Row label="Service wording" value={preview.new_plan.service_wording} />
            <Row label="Net" value={fmt(preview.new_plan.monthly_net)} />
            <Row label={`VAT @ ${preview.new_plan.vat_rate}%`} value={fmt(preview.new_plan.monthly_vat)} />
            <Row label="Gross / month" value={fmt(preview.new_plan.monthly_gross)} highlight />
            <Row label="Plan type" value={preview.new_plan.plan_type} />
            <Row label="Contract length" value={preview.new_plan.contract_length_months == null ? "Flexible — no minimum term" : `${preview.new_plan.contract_length_months} months`} />
            <p className="text-xs text-muted-foreground pt-2 border-t">{preview.new_plan.usage_wording}</p>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Final legacy invoice (May – July 2026)</h2>
            {preview.legacy_invoice.already_created ? (
              <div className="text-sm space-y-1">
                <Row label="Existing invoice" value={preview.legacy_invoice.already_created.invoice_number} highlight />
                <Row label="Status" value={preview.legacy_invoice.already_created.status} />
                <Row label="Issued" value={preview.legacy_invoice.already_created.issue_date} />
                <Row label="Due" value={preview.legacy_invoice.already_created.due_date} />
                <Row label="Total" value={fmt(preview.legacy_invoice.already_created.total)} />
                <Row label="Payment request" value={preview.legacy_invoice.already_created.payment_request_number} />
                <p className="text-xs text-muted-foreground pt-2">Invoice already exists — will be reused (no duplicate).</p>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <Row label="Period" value={`${preview.legacy_invoice.period_start} – ${preview.legacy_invoice.period_end}`} />
                <Row label="Subtotal" value={fmt(preview.legacy_invoice.subtotal)} />
                <Row label="VAT" value={fmt(preview.legacy_invoice.vat_total)} />
                <Row label="Total" value={fmt(preview.legacy_invoice.total)} highlight />
                <Row label="VAT treatment" value={preview.legacy_invoice.vat_treatment} />
                <div className="border-t border-muted mt-2 pt-2 space-y-2">
                  {preview.legacy_invoice.lines.map((l, i) => (
                    <div key={i} className="text-xs">
                      <div className="font-mono">£{l.net.toFixed(2)} · VAT {l.vat_rate}%</div>
                      <div className="text-muted-foreground">{l.description}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-2">Invoice + card payment link will be created when you click Send.</p>
              </div>
            )}
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Billing</h2>
            <Row label="Anchor day" value={String(preview.billing.anchor_day)} />
            <Row label="Effective start" value={preview.billing.effective_start_date} highlight />
            <Row label="Back-billing" value={preview.billing.no_back_billing ? "No" : "Yes"} />
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Collection blocked until all of:</div>
              <ul className="list-disc pl-5">
                {preview.billing.collection_blocked_until.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Email preview</h2>
            <Row label="To" value={preview.recipient_email} />
            <Row label="Subject" value={preview.email_subject} />
            <details className="border-2 border-muted p-3">
              <summary className="cursor-pointer font-medium">Show rendered HTML preview</summary>
              <div className="mt-3 border border-muted-foreground/30 max-h-[500px] overflow-auto">
                <iframe
                  title="Email preview"
                  className="w-full h-[500px] bg-white"
                  sandbox=""
                  srcDoc={preview.email_html_preview}
                />
              </div>
            </details>
          </Card>

          <Card className="p-6 border-4 border-foreground bg-yellow-50">
            <h2 className="text-lg font-semibold uppercase tracking-wide mb-3">Send</h2>
            <p className="text-sm mb-4">This will create the quote, block billing on the existing service, and email the recipient. Nothing has happened yet.</p>
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
              <Row label="Quote" value={sent.quote_number} />
              <Row label="Quote ID" value={sent.quote_id} mono />
              <Row label="Journey URL" value={sent.journey_url} mono />
              <Row label="Service ID" value={sent.service_id} mono />
              <Row label="Billing blocked" value={String(sent.billing_blocked)} />
              <Row label="Legacy invoice" value={sent.legacy_invoice_number} highlight />
              <Row label="Legacy pay URL" value={sent.legacy_invoice_pay_url} mono />
              <p className="text-sm text-muted-foreground pt-2">The recipient will now review the Contract Summary, e-sign, and enter Direct Debit bank details in the unified journey. Recurring billing stays off until the DD mandate is active.</p>
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

export default AdminLegacyRemediation;