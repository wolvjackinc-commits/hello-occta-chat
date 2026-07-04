// Shared OCCTA-branded email shell. Mirrors the Contract Summary view:
// 4px black bordered container, OCCTA header band with logo tile + tagline,
// uppercase section eyebrows, brutalist cards, solid black CTA, legal footer.
// Inline styles only — no <style>, no JS, no web fonts. Safe for Gmail/Outlook.

const BRAND = {
  bg: "#ffffff",
  ink: "#111111",
  muted: "#666666",
  border: "4px solid #111111",
  borderThin: "2px solid #111111",
  primary: "#FFD100", // OCCTA yellow
  primaryInk: "#111111",
  secondary: "#FAFAFA",
};

export interface ShellOptions {
  preheader: string;
  eyebrow: string; // small uppercase label in header (e.g. "Welcome — service live")
  reference?: string; // shown right of eyebrow (order/invoice number)
  topImageUrl?: string; // optional hero/animation image
  topImageAlt?: string;
  greeting: string; // e.g. "Welcome, Jane"
  intro: string; // first paragraph (HTML allowed)
  sections: Array<{ heading: string; html: string }>;
  cta?: { label: string; url: string };
  closingHtml?: string; // optional small text before signature
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c],
  );
}

export function renderBrandedEmail(opts: ShellOptions): string {
  const sections = opts.sections
    .map(
      (s) => `
        <div style="border:${BRAND.border};padding:20px;margin:0 0 16px 0;background:${BRAND.bg}">
          <p style="margin:0 0 10px 0;font:600 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted}">${esc(s.heading)}</p>
          <div style="font:14px/1.55 Arial,Helvetica,sans-serif;color:${BRAND.ink}">${s.html}</div>
        </div>`,
    )
    .join("");

  const ctaBlock = opts.cta
    ? `
      <div style="margin:8px 0 24px 0">
        <!-- Brutalist offset-shadow CTA: outer wrapper provides the shadow, inner the button -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${BRAND.ink}">
          <a href="${esc(opts.cta.url)}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;font:700 14px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:14px 22px;border:${BRAND.borderThin};position:relative;top:-4px;left:-4px">${esc(opts.cta.label)} →</a>
        </td></tr></table>
      </div>`
    : "";

  const topImage = opts.topImageUrl
    ? `<img src="${esc(opts.topImageUrl)}" alt="${esc(opts.topImageAlt ?? "")}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:0 0 4px 0">`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OCCTA</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink}">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;font-size:1px;line-height:1px">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <!-- Branded header band — matches ContractSummaryView.tsx -->
    <tr><td style="border:${BRAND.border};background:${BRAND.bg}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.secondary};border-bottom:${BRAND.border}">
        <tr>
          <td style="padding:16px 20px;vertical-align:middle" width="76">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${BRAND.primary};border:${BRAND.borderThin};width:56px;height:56px;text-align:center;vertical-align:middle"><span style="font:700 28px/56px Arial Black,Arial,sans-serif;color:${BRAND.primaryInk}">O</span></td></tr></table>
          </td>
          <td style="padding:16px 12px;vertical-align:middle">
            <div style="font:700 22px/1 Arial Black,Arial,sans-serif;letter-spacing:-0.5px">OCCTA</div>
            <div style="font:500 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin-top:4px">Brilliant Made Simple</div>
          </td>
          <td align="right" style="padding:16px 20px;vertical-align:middle">
            <div style="font:600 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted}">${esc(opts.eyebrow)}</div>
            ${opts.reference ? `<div style="font:700 13px/1 Arial,Helvetica,sans-serif;margin-top:6px">${esc(opts.reference)}</div>` : ""}
          </td>
        </tr>
      </table>
      <div style="padding:24px 24px 20px 24px">
        ${topImage}
        <h1 style="margin:8px 0 12px 0;font:700 26px/1.15 Arial Black,Arial,sans-serif;text-transform:uppercase;letter-spacing:-0.5px">${esc(opts.greeting)}</h1>
        <div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:${BRAND.ink}">${opts.intro}</div>
      </div>
    </td></tr>
    <tr><td style="padding:16px 0 0 0">
      ${sections}
      ${ctaBlock}
      ${opts.closingHtml ? `<div style="font:13px/1.6 Arial,Helvetica,sans-serif;color:${BRAND.muted};padding:0 4px 16px 4px">${opts.closingHtml}</div>` : ""}
    </td></tr>
    <!-- Footer -->
    <tr><td style="border-top:${BRAND.borderThin};padding:18px 4px;font:11px/1.6 Arial,Helvetica,sans-serif;color:${BRAND.muted}">
      <strong style="color:${BRAND.ink}">OCCTA LIMITED</strong> · Company No. 13828933<br>
      22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom<br>
      Support: <a href="mailto:hello@occta.co.uk" style="color:${BRAND.ink}">hello@occta.co.uk</a> · Help centre: <a href="https://www.occta.co.uk/help" style="color:${BRAND.ink}">occta.co.uk/help</a><br>
      You're receiving this because you have an active service with OCCTA. Regulated by Ofcom · ADR scheme: CISAS.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export const escapeEmailHtml = esc;