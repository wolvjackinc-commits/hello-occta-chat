// deno-lint-ignore-file no-explicit-any
// Standard OCCTA email footer, shared by every customer email.
//
// UK Companies Act 2006 company details, table-based with inline styles so the
// links line up and stay tappable in Gmail, Outlook and Apple Mail on phones.
// Every link must point at a live route on www.occta.co.uk.
//
// HELPFUL_LINKS_SLOT marks where the "Helpful reading" card is dropped, so it
// sits inside the email just above the footer rather than loose underneath it.

export const HELPFUL_LINKS_SLOT = "<!--OCCTA_HELPFUL_LINKS-->";

export const OCCTA_PHONE_DISPLAY = "0800 260 6626";
export const OCCTA_PHONE_TEL = "tel:+448002606626";

/** Phone number as a tappable link that never wraps mid-number. */
export function phoneLinkHtml(color = "#0d0d0d"): string {
  return `<a href="${OCCTA_PHONE_TEL}" style="color:${color};font-weight:bold;text-decoration:none;white-space:nowrap;">0800&nbsp;260&nbsp;6626</a>`;
}

export const getStandardFooter = (options?: { showUnsubscribe?: boolean; accentColor?: string }) => {
  const siteUrl = (globalThis as any).Deno?.env.get("SITE_URL") || "https://www.occta.co.uk";
  const accentColor = options?.accentColor || '#facc15';
  const currentYear = new Date().getFullYear();
  const font = "font-family:Helvetica,Arial,sans-serif;";
  const link = (href: string, label: string) =>
    `<td align="center" style="padding:6px 10px;"><a href="${href}" style="${font}color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">${label}</a></td>`;

  return `${HELPFUL_LINKS_SLOT}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;">
      <tr><td align="center" style="padding:30px 24px 26px;${font}">
        <div style="${font}font-size:22px;font-weight:bold;letter-spacing:6px;color:${accentColor};">OCCTA</div>
        <div style="${font}font-size:11px;color:#8a8a8a;letter-spacing:1px;padding-top:4px;">Telecom that gets it</div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;"><tr>
          ${link(`${siteUrl}/dashboard`, "My account")}
          ${link(`${siteUrl}/help`, "Help")}
          ${link(`${siteUrl}/support`, "Contact")}
        </tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid #2a2a2a;"><tr><td align="center" style="padding-top:20px;${font}">
          <div style="font-size:13px;line-height:22px;color:#bbbbbb;">Need help? Call ${phoneLinkHtml("#ffffff")}</div>
          <div style="font-size:13px;line-height:22px;color:#bbbbbb;">or email <a href="mailto:hello@occta.co.uk" style="color:${accentColor};text-decoration:none;white-space:nowrap;">hello@occta.co.uk</a></div>
          <div style="font-size:11px;line-height:18px;color:#777777;padding-top:4px;">Lines open Monday to Friday, 8am to 6pm</div>
        </td></tr></table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid #2a2a2a;"><tr><td align="center" style="padding-top:16px;${font}">
          <div style="font-size:11px;line-height:18px;">
            <a href="${siteUrl}/privacy" style="color:#8a8a8a;text-decoration:underline;white-space:nowrap;">Privacy policy</a>
            <span style="color:#444444;">&nbsp;&middot;&nbsp;</span>
            <a href="${siteUrl}/terms" style="color:#8a8a8a;text-decoration:underline;white-space:nowrap;">Terms</a>
            <span style="color:#444444;">&nbsp;&middot;&nbsp;</span>
            <a href="${siteUrl}/complaints" style="color:#8a8a8a;text-decoration:underline;white-space:nowrap;">Complaints</a>
          </div>
          <div style="font-size:10px;line-height:16px;color:#666666;padding-top:10px;">&copy; ${currentYear} OCCTA Limited. All rights reserved.</div>
          <div style="font-size:10px;line-height:16px;color:#555555;">OCCTA Limited is registered in England and Wales, company no. 13828933.<br>Registered office: 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom.</div>
          ${options?.showUnsubscribe ? `<div style="padding-top:10px;"><a href="${siteUrl}/dashboard" style="color:#666666;font-size:10px;text-decoration:underline;">Manage email preferences</a></div>` : ''}
        </td></tr></table>
      </td></tr>
    </table>`;
};
