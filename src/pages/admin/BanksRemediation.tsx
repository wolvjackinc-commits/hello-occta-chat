import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Link2 } from "lucide-react";

type Preview = {
  customer: {
    exists: boolean;
    id: string | null;
    account_number: string;
    holder_name: string;
    cli: string;
    address: string;
    customer_type: string;
    account_status: string;
    contact_email: string;
    deputy: string;
    co_deputy: string;
    contact_preference: string;
    care_note: string;
    history: Record<string, string>;
  };
  service: {
    exists: boolean;
    id: string | null;
    service_type: string;
    plan_name: string;
    monthly_gross: number;
    monthly_net: number;
    monthly_vat: number;
    vat_rate: number;
    vat_treatment: string;
    billing_frequency: string;
    payment_method: string;
    dd_collection_day: number;
    included: string[];
    notice_period: string;
  };
  payment: { amount: number; date: string; note: string };
  dd_schedule: {
    first_amount: number;
    first_date: string;
    first_covers: string;
    regular_from: string;
    regular_amount: number;
  };
  documents: Record<string, string | number | null>;
  email_subject: string;
  email_html_preview: string;
  prepared: boolean;
};

type PrepareResult = {
  ok: true;
  action: "prepare" | "send";
  email_sent: boolean;
  created: Record<string, boolean>;
  customer_id: string;
  account_number: string;
  service_id: string;
  quote_number: string;
  cs_number: string;
  dd_request_number: string;
  sign_url: string;
  dd_url: string;
  email_subject?: string;
  email_html_preview?: string;
};

export function AdminBanksRemediation() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [sent, setSent] = useState<PrepareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "preview" | "prepare" | "send") {
    setError(null);
    const { data, error } = await supabase.functions.invoke("admin-banks-remediation", {
      body: { action, confirm: action !== "preview" },
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
      throw new Error(detail || error.message || `${action} failed`);
    }
    if ((data as any)?.error) throw new Error((data as any).details || (data as any).message || (data as any).error);
    return data as any;
  }

  async function loadPreview() {
    setLoading(true);
    try {
      const data = await call("preview");
      setPreview(data.preview as Preview);
    } catch (e: any) {
      setError(e?.message || "Preview failed");
      toast.error(e?.message || "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function prepareRecords() {
    if (!window.confirm(
      "Create/refresh the Janet Banks records and mint live links?\n\n" +
      "• Customer A00001 and landline service (created only if missing)\n" +
      "• Account agreement (Contract Summary) with a real signing link\n" +
      "• Direct Debit mandate setup link\n\n" +
      "NO email is sent by this step.",
    )) return;
    setWorking(true);
    try {
      const data = await call("prepare");
      setPrepared(data as PrepareResult);
      toast.success("Records ready — links minted. No email sent.");
    } catch (e: any) {
      setError(e?.message || "Prepare failed");
      toast.error(e?.message || "Prepare failed");
    } finally {
      setWorking(false);
    }
  }

  async function sendEmail() {
    if (!window.confirm(
      "FINAL CONFIRMATION\n\nSend the branded email to debbie.syphas@hmrc.gov.uk?\n\n" +
      "It contains the real account agreement signing link and the real Direct Debit setup link. " +
      "Fresh links are minted so the emailed links are always live.\n\nContinue?",
    )) return;
    setWorking(true);
    try {
      const data = await call("send");
      setSent(data as PrepareResult);
      setPrepared(data as PrepareResult);
      toast.success("Email sent to the authorised deputy");
    } catch (e: any) {
      setError(e?.message || "Send failed");
      toast.error(e?.message || "Send failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-display uppercase tracking-tight">Janet Banks — Account Setup (A00001)</h1>
        <p className="text-muted-foreground mt-2">
          Live legacy telephone account. Mrs Janet Banks is the account holder; all correspondence goes to
          her authorised Court of Protection deputy, <strong>Debbie Syphas</strong>. Preview, prepare the records
          and links, then send the email manually.
        </p>
      </header>

      <Card className="p-6 border-2 border-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-yellow-600 shrink-0" />
          <div className="text-sm space-y-1">
            <p><strong>No email is sent until you click “Send email”.</strong> Records are idempotent — running this
            more than once will not create duplicate customers, services, agreements or Direct Debit links.
            Bank details are never collected or shown here; they are entered by the deputy on the secure Direct Debit page.</p>
          </div>
        </div>
      </Card>

      {!preview && (
        <Button onClick={loadPreview} disabled={loading} className="border-2 border-foreground">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading preview…</> : "Load preview"}
        </Button>
      )}

      {error && <Card className="p-4 border-2 border-destructive text-sm text-destructive">{error}</Card>}

      {preview && (
        <>
          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Customer record</h2>
            <Row label="Exists in system" value={preview.customer.exists ? "Yes" : "No — will be created"} highlight={!preview.customer.exists} />
            <Row label="Account holder" value={preview.customer.holder_name} highlight />
            <Row label="Account number" value={preview.customer.account_number} />
            <Row label="Telephone / CLI" value={preview.customer.cli} />
            <Row label="Service address" value={preview.customer.address} />
            <Row label="Customer type" value={preview.customer.customer_type} />
            <Row label="Account status" value={preview.customer.account_status} />
            <Row label="Authorised contact email" value={preview.customer.contact_email} highlight />
            <Row label="Authorised representative" value={preview.customer.deputy} />
            <Row label="Co-deputy" value={preview.customer.co_deputy} />
            <Row label="Contact preference" value={preview.customer.contact_preference} />
            <p className="text-xs text-muted-foreground pt-2 border-t">{preview.customer.care_note}</p>
            <div className="text-sm pt-2 border-t space-y-1">
              {Object.entries(preview.customer.history).map(([k, v]) => (
                <Row key={k} label={k.replace(/_/g, " ")} value={v} />
              ))}
            </div>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Service &amp; package</h2>
            <Row label="Exists in system" value={preview.service.exists ? "Yes" : "No — will be created"} highlight={!preview.service.exists} />
            <Row label="Service type" value={preview.service.service_type} />
            <Row label="Package" value={preview.service.plan_name} highlight />
            <Row label="Monthly (inc VAT)" value={`£${preview.service.monthly_gross.toFixed(2)}`} highlight />
            <Row label="Net / VAT" value={`£${preview.service.monthly_net.toFixed(2)} + £${preview.service.monthly_vat.toFixed(2)} VAT @ ${preview.service.vat_rate}%`} />
            <Row label="Billing frequency" value={preview.service.billing_frequency} />
            <Row label="Payment method" value={`${preview.service.payment_method} — ${preview.service.dd_collection_day}st of each month`} />
            <Row label="Notice period" value={preview.service.notice_period} />
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Included</div>
              <ul className="list-disc pl-5">{preview.service.included.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Payment &amp; Direct Debit schedule</h2>
            <Row label="Payment received" value={`£${preview.payment.amount.toFixed(2)} on ${preview.payment.date}`} highlight />
            <p className="text-xs text-muted-foreground">{preview.payment.note}</p>
            <Row label="First DD collection" value={`£${preview.dd_schedule.first_amount.toFixed(2)} on or after ${preview.dd_schedule.first_date}`} highlight />
            <Row label="First collection covers" value={preview.dd_schedule.first_covers} />
            <Row label="Regular monthly DD" value={`£${preview.dd_schedule.regular_amount.toFixed(2)} from ${preview.dd_schedule.regular_from}`} />
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Documents on record</h2>
            {Object.entries(preview.documents).map(([k, v]) => (
              <Row key={k} label={k.replace(/_/g, " ")} value={v == null ? "—" : String(v)} />
            ))}
          </Card>

          <Card className="p-6 border-4 border-foreground space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Step 1 — Prepare records &amp; links</h2>
            <p className="text-sm">
              Creates anything missing and mints a live account agreement signing link plus a live Direct Debit
              mandate setup link. Nothing is emailed.
            </p>
            <Button onClick={prepareRecords} disabled={working} className="border-2 border-foreground">
              {working ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> : <><Link2 className="w-4 h-4 mr-2" />Prepare records &amp; mint links</>}
            </Button>
            {prepared && (
              <div className="space-y-2 pt-3 border-t">
                <Row label="Customer ID" value={prepared.customer_id} mono />
                <Row label="Account number" value={prepared.account_number} />
                <Row label="Service ID" value={prepared.service_id} mono />
                <Row label="Quote" value={prepared.quote_number} />
                <Row label="Agreement (Contract Summary)" value={prepared.cs_number} highlight />
                <Row label="DD request" value={prepared.dd_request_number} />
                <Row label="Signing link" value={prepared.sign_url} mono />
                <Row label="Direct Debit link" value={prepared.dd_url} mono />
                <p className="text-xs text-muted-foreground">
                  Records created this run: {Object.entries(prepared.created).filter(([, v]) => v).map(([k]) => k).join(", ") || "none (all existed already)"}
                </p>
              </div>
            )}
          </Card>

          <Card className="p-6 border-2 border-foreground space-y-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Email preview</h2>
            <Row label="To" value={preview.customer.contact_email} />
            <Row label="Subject" value={preview.email_subject} />
            <details className="border-2 border-muted p-3">
              <summary className="cursor-pointer font-medium">Show rendered email</summary>
              <div className="mt-3 border border-muted-foreground/30 max-h-[600px] overflow-auto">
                <iframe
                  title="Email preview"
                  className="w-full h-[600px] bg-white"
                  sandbox=""
                  srcDoc={prepared?.email_html_preview ?? preview.email_html_preview}
                />
              </div>
            </details>
            <p className="text-xs text-muted-foreground">
              Before preparing, the two links show as placeholders in this preview. After preparing, the preview
              shows the real links that will be emailed.
            </p>
          </Card>

          <Card className="p-6 border-4 border-foreground bg-yellow-50 space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Step 2 — Send email</h2>
            <p className="text-sm">
              Sends the branded email to <strong>debbie.syphas@hmrc.gov.uk</strong>. Fresh links are minted at send
              time so the emailed links are guaranteed live. No email has been sent yet.
            </p>
            <Button
              onClick={sendEmail}
              disabled={working || !!sent}
              className="border-2 border-foreground bg-foreground text-background hover:bg-foreground/90"
            >
              {working ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Mail className="w-4 h-4 mr-2" />Send email to authorised deputy</>}
            </Button>
          </Card>

          {sent && (
            <Card className="p-6 border-2 border-green-700 bg-green-50 space-y-2">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <strong>Email sent</strong>
              </div>
              <Row label="Agreement" value={sent.cs_number} highlight />
              <Row label="DD request" value={sent.dd_request_number} />
              <Row label="Signing link" value={sent.sign_url} mono />
              <Row label="Direct Debit link" value={sent.dd_url} mono />
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
      <div className="text-muted-foreground min-w-[200px] capitalize">{label}</div>
      <div className={`${highlight ? "font-bold" : ""} ${mono ? "font-mono text-xs break-all" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

export default AdminBanksRemediation;
