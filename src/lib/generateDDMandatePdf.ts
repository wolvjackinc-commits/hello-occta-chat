import { format } from "date-fns";
import { DD_GUARANTEE_TEXT } from "@/lib/legal/directDebitGuarantee";

export type DDMandatePdfData = {
  mandate_reference: string;
  status: string;
  account_holder: string | null;
  sort_code_masked: string | null;
  account_number_masked: string | null;
  bank_last4: string | null;
  consent_timestamp: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  next_collection_date?: string | null;
  next_collection_amount?: number | null;
  contract_reference?: string | null;
};

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd MMM yyyy"); } catch { return "—"; }
}

/** Open a print-ready Direct Debit mandate confirmation in a new tab. */
export function generateDDMandatePdf(m: DDMandatePdfData): void {
  const guaranteeParas = DD_GUARANTEE_TEXT.split(/\n\n+/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const nextAmount = typeof m.next_collection_amount === "number"
    ? `£${m.next_collection_amount.toFixed(2)}`
    : null;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Direct Debit Mandate — ${esc(m.mandate_reference)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f0;color:#0d0d0d;padding:32px}
  .container{max-width:720px;margin:0 auto;background:#fff;border:4px solid #0d0d0d;box-shadow:10px 10px 0 0 #0d0d0d}
  .header{background:#0d0d0d;color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-weight:900;letter-spacing:.2em;font-size:22px}
  .logo span{background:#facc15;color:#0d0d0d;padding:2px 8px;margin-left:6px}
  .badge{font-weight:900;letter-spacing:.2em;font-size:14px}
  .banner{background:#facc15;color:#0d0d0d;text-align:center;padding:14px;border-bottom:4px solid #0d0d0d;font-weight:900;letter-spacing:.15em;text-transform:uppercase;font-size:14px}
  .content{padding:28px}
  .box{background:#f5f5f0;border:3px solid #0d0d0d;padding:20px;margin-bottom:20px}
  .box h3{font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:13px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #0d0d0d}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ccc;font-size:13px}
  .row:last-child{border-bottom:none}
  .lbl{color:#555;text-transform:uppercase;letter-spacing:.1em;font-size:11px;font-weight:700}
  .val{font-weight:700;text-align:right}
  .next{background:#0d0d0d;color:#fff;padding:20px;text-align:center;margin-bottom:20px}
  .next .lbl{color:#facc15}
  .next .amt{font-size:32px;font-weight:900;margin:6px 0}
  .guarantee{border:3px solid #0d0d0d;padding:18px;background:#fff}
  .guarantee h3{margin-bottom:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:13px}
  .guarantee p{font-size:12px;line-height:1.55;margin-bottom:10px}
  .guarantee p:last-child{margin-bottom:0}
  .foot{background:#f5f5f0;padding:16px 28px;font-size:11px;color:#555;border-top:2px solid #0d0d0d;text-align:center}
  .service{background:#fff;border:2px solid #0d0d0d;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;font-size:12px}
  .service strong{display:block;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
  @media print{body{padding:0;background:#fff}.container{box-shadow:none;border:2px solid #0d0d0d}}
</style>
</head><body>
<div class="container">
  <div class="header">
    <div class="logo">OCCTA<span>TELECOM</span></div>
    <div class="badge">DIRECT DEBIT MANDATE</div>
  </div>
  <div class="banner">Instruction to your Bank or Building Society to pay by Direct Debit</div>
  <div class="content">
    <div class="service">
      <div><strong>Service User Name</strong>OCCTA Limited</div>
      <div><strong>Service User Number</strong>To be assigned on Bacs submission</div>
      <div><strong>Mandate Reference</strong>${esc(m.mandate_reference)}</div>
    </div>

    <div class="box">
      <h3>Customer</h3>
      <div class="row"><span class="lbl">Account holder</span><span class="val">${esc(m.account_holder)}</span></div>
      ${m.customer_name ? `<div class="row"><span class="lbl">Customer</span><span class="val">${esc(m.customer_name)}</span></div>` : ""}
      ${m.customer_email ? `<div class="row"><span class="lbl">Email</span><span class="val">${esc(m.customer_email)}</span></div>` : ""}
      ${m.customer_address ? `<div class="row"><span class="lbl">Address</span><span class="val">${esc(m.customer_address)}</span></div>` : ""}
      ${m.contract_reference ? `<div class="row"><span class="lbl">Contract</span><span class="val">${esc(m.contract_reference)}</span></div>` : ""}
    </div>

    <div class="box">
      <h3>Bank details captured</h3>
      <div class="row"><span class="lbl">Sort code</span><span class="val">${esc(m.sort_code_masked) || "—"}</span></div>
      <div class="row"><span class="lbl">Account number</span><span class="val">${esc(m.account_number_masked) || (m.bank_last4 ? `••••${esc(m.bank_last4)}` : "—")}</span></div>
      <div class="row"><span class="lbl">Status</span><span class="val" style="text-transform:capitalize">${esc(m.status.replace(/_/g," "))}</span></div>
      <div class="row"><span class="lbl">Consent captured</span><span class="val">${fmtDate(m.consent_timestamp || m.created_at)}</span></div>
    </div>

    ${m.next_collection_date ? `
    <div class="next">
      <div class="lbl" style="font-size:11px;letter-spacing:.2em;">Next collection</div>
      ${nextAmount ? `<div class="amt">${nextAmount}</div>` : ""}
      <div>on ${fmtDate(m.next_collection_date)}</div>
      <div style="font-size:11px;color:#facc15;margin-top:6px;">Advance notice will be issued at least 10 working days before collection.</div>
    </div>` : ""}

    <div class="guarantee">
      <h3>The Direct Debit Guarantee</h3>
      ${guaranteeParas}
    </div>
  </div>
  <div class="foot">
    OCCTA Limited · Company No. 13828933 · Registered office: 22 Pavilion View, Huddersfield, HD3 3WU · hello@occta.co.uk
  </div>
</div>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)});</script>
</body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}