import { format } from "date-fns";

export interface BusinessQuoteData {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  siteCount?: number;
  slaPreference?: string;
  services: string[];
  requirements: Record<string, string>;
  message?: string;
  reference?: string;
}

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SERVICE_LABELS: Record<string, string> = {
  broadband: "Business Broadband",
  voice: "Hosted VoIP / SIP",
  sim: "Business SIMs",
  bundle: "Multi-service bundle",
  leased_line: "Leased line / dedicated",
};

export function generateBusinessQuotePdf(q: BusinessQuoteData): void {
  const now = format(new Date(), "dd MMM yyyy HH:mm");
  const ref = q.reference || `BQ-${Date.now().toString(36).toUpperCase()}`;
  const reqRows = Object.entries(q.requirements || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(v)}</td></tr>`) 
    .join("");
  const services = q.services.map((s) => `<li>${esc(SERVICE_LABELS[s] || s)}</li>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Business Quote ${esc(ref)}</title>
  <style>
    body{font-family:'Inter',sans-serif;color:#0d0d0d;background:#fff;padding:40px;max-width:720px;margin:0 auto;}
    h1{font-family:'Bebas Neue',sans-serif;font-size:38px;letter-spacing:1px;margin:0 0 4px;text-transform:uppercase;}
    h2{font-family:'Bebas Neue',sans-serif;font-size:20px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px;}
    .box{border:4px solid #0d0d0d;padding:16px;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;}
    td{padding:6px 8px;border-bottom:1px solid #0d0d0d33;vertical-align:top;}
    td:first-child{width:40%;font-weight:600;text-transform:capitalize;}
    .meta{color:#555;font-size:12px;}
    ul{margin:8px 0 0 20px;}
    .footer{margin-top:32px;font-size:11px;color:#666;border-top:1px solid #0d0d0d;padding-top:12px;}
    @media print{ body{padding:24px;} .noprint{display:none;} }
    .btn{display:inline-block;padding:10px 16px;background:#0d0d0d;color:#fff;text-decoration:none;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;margin-right:8px;}
  </style></head>
  <body>
    <div class="noprint" style="margin-bottom:16px;">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn" style="background:#666" onclick="window.close()">Close</button>
    </div>
    <h1>Business Quote Request</h1>
    <div class="meta">Reference: ${esc(ref)} · Submitted ${esc(now)}</div>

    <h2>Company</h2>
    <div class="box">
      <table>
        <tr><td>Company</td><td>${esc(q.companyName)}</td></tr>
        <tr><td>Contact</td><td>${esc(q.contactName)}</td></tr>
        <tr><td>Email</td><td>${esc(q.email)}</td></tr>
        ${q.phone ? `<tr><td>Phone</td><td>${esc(q.phone)}</td></tr>` : ""}
        ${q.siteCount ? `<tr><td>Number of sites</td><td>${esc(String(q.siteCount))}</td></tr>` : ""}
        ${q.slaPreference ? `<tr><td>SLA preference</td><td>${esc(q.slaPreference)}</td></tr>` : ""}
      </table>
    </div>

    <h2>Services requested</h2>
    <div class="box"><ul>${services || "<li>None specified</li>"}</ul></div>

    ${reqRows ? `<h2>Requirements</h2><div class="box"><table>${reqRows}</table></div>` : ""}

    ${q.message ? `<h2>Additional notes</h2><div class="box">${esc(q.message)}</div>` : ""}

    <div class="footer">
      OCCTA Limited — Simple telecom. Clear terms.<br/>
      A UK-based specialist will follow up within 1 working day. Prices for business are ex-VAT.
    </div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to download your quote PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
}