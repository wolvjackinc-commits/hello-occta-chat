import { format } from "date-fns";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { companyConfig, isVatApplicableFor } from "@/lib/companyConfig";

export type PaymentReceiptData = {
  receipt_ref: string;
  payment_request_number: string;
  amount: number;
  currency: string;
  paid_at: string;
  provider: string;
  provider_payment_id: string | null;
  customer_name: string;
  customer_email: string;
  account_number: string | null;
  contract_summary: {
    cs_number: string;
    plan_name: string;
    monthly_price_incl_vat: number;
  } | null;
};

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/** Open a print-ready branded payment receipt in a new tab. */
export function generatePaymentReceiptPdf(r: PaymentReceiptData): void {
  const showVatNumber = isVatApplicableFor(r.paid_at);
  const safe = {
    receipt_ref: escapeHtml(r.receipt_ref),
    prn: escapeHtml(r.payment_request_number),
    amount: Number(r.amount || 0),
    currency: escapeHtml(r.currency || "GBP"),
    paid_at: r.paid_at,
    provider: escapeHtml(r.provider || "Worldpay"),
    txn: escapeHtml(r.provider_payment_id ?? ""),
    name: escapeHtml(r.customer_name),
    email: escapeHtml(r.customer_email),
    account: escapeHtml(r.account_number ?? ""),
    cs_number: escapeHtml(r.contract_summary?.cs_number ?? ""),
    plan: escapeHtml(r.contract_summary?.plan_name ?? ""),
  };

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Payment receipt — ${safe.receipt_ref}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f0;color:#0d0d0d;padding:32px}
  .container{max-width:640px;margin:0 auto;background:#fff;border:4px solid #0d0d0d;box-shadow:10px 10px 0 0 #0d0d0d}
  .header{background:#0d0d0d;color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-weight:900;letter-spacing:.2em;font-size:22px}
  .logo span{background:#facc15;color:#0d0d0d;padding:2px 8px;margin-left:6px}
  .badge{font-weight:900;letter-spacing:.2em;font-size:16px}
  .banner{background:#22c55e;color:#fff;text-align:center;padding:18px;border-bottom:4px solid #0d0d0d;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
  .content{padding:28px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}
  .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:#666}
  .val{font-weight:700;font-size:14px;word-break:break-all}
  .box{background:#f5f5f0;border:3px solid #0d0d0d;padding:20px;margin-bottom:20px}
  .box h3{font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:13px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #0d0d0d}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ccc;font-size:13px}
  .row:last-child{border-bottom:none}
  .amount{background:#0d0d0d;color:#fff;padding:18px;text-align:center}
  .amount .lbl{color:#facc15;margin-bottom:6px}
  .amount .val{font-size:36px;letter-spacing:.05em}
  .footer{background:#f5f5f0;padding:18px 28px;text-align:center;font-size:11px;color:#555;border-top:2px solid #0d0d0d}
  @media print{body{padding:0;background:#fff}.container{box-shadow:none;border:2px solid #0d0d0d}}
</style>
</head><body>
<div class="container">
  <div class="header">
    <div class="logo">OCCTA<span>TELECOM</span></div>
    <div class="badge">RECEIPT</div>
  </div>
  <div class="banner">Payment received</div>
  <div class="content">
    <div class="grid">
      <div><div class="lbl">Receipt</div><div class="val">${safe.receipt_ref}</div></div>
      <div><div class="lbl">Payment ref</div><div class="val">${safe.prn}</div></div>
      <div><div class="lbl">Paid</div><div class="val">${format(new Date(safe.paid_at), "dd MMM yyyy, HH:mm")}</div></div>
      <div><div class="lbl">Method</div><div class="val">${safe.provider}</div></div>
    </div>
    <div class="box">
      <h3>Payer</h3>
      <div class="row"><span class="lbl">Customer</span><span class="val">${safe.name}</span></div>
      ${safe.account ? `<div class="row"><span class="lbl">Account</span><span class="val">${safe.account}</span></div>` : ""}
      <div class="row"><span class="lbl">Email</span><span class="val">${safe.email}</span></div>
      ${safe.txn ? `<div class="row"><span class="lbl">Transaction</span><span class="val">${safe.txn}</span></div>` : ""}
      ${safe.cs_number ? `<div class="row"><span class="lbl">Contract Summary</span><span class="val">${safe.cs_number}</span></div>` : ""}
      ${safe.plan ? `<div class="row"><span class="lbl">Plan</span><span class="val">${safe.plan}</span></div>` : ""}
    </div>
    <div class="amount">
      <div class="lbl">Amount paid</div>
      <div class="val">£${safe.amount.toFixed(2)}</div>
    </div>
    <p style="text-align:center;color:#666;font-size:12px;margin-top:18px">Thank you. This receipt confirms your payment to OCCTA Ltd.</p>
  </div>
  <div class="footer">
    <strong>OCCTA Telecom</strong> · Keeping the UK connected.<br/>
    ${CONTACT_PHONE_DISPLAY} · hello@occta.co.uk<br/>
    Company No. ${companyConfig.companyNumber}${showVatNumber ? ` · VAT No. ${companyConfig.vatNumber}` : ""} · Registered: ${companyConfig.address.oneLine}
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}