// Fetch a small block of "Helpful links" (2-4 KB articles) mapped to a
// transactional email template via the `email_template_help_links` table.
//
// Returns a ready-to-inject HTML string in the OCCTA brutalist card style,
// or an empty string when nothing is mapped / configured. Safe to call from
// any Edge Function that already has a service-role Supabase client.
//
// SAFETY:
//   - Only surfaces KB articles with status = "approved" AND visibility =
//     "public". Never leaks customer-only content into unauthenticated emails.
//   - Never throws — email sending must never be blocked by a link lookup
//     failure.
//   - Hard-caps at 4 links to keep emails scannable.
// deno-lint-ignore-file no-explicit-any

const APP_BASE = "https://www.occta.co.uk";

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c],
  );
}

function slugToPath(slug: string, kind: string): string {
  const seg = kind === "blog" ? "blog" : kind === "guide" ? "guides" : "help";
  return `${APP_BASE}/${seg}/${encodeURIComponent(slug)}`;
}

export interface HelpfulLink { title: string; url: string; summary?: string | null }

// OCCTA takes Direct Debit or bank transfer only. These old KB articles describe
// card / Worldpay payment links, so emails always point at the current pages
// instead, even if a template mapping still names the old slug.
const RETIRED_ARTICLE_REPLACEMENTS: Record<string, HelpfulLink> = {
  "how-to-pay-by-invoice-link": {
    title: "How to pay your OCCTA bill",
    url: `${APP_BASE}/help/pay-by-bank-transfer`,
    summary: "Direct Debit or bank transfer: our bank details and the reference to use.",
  },
  "invoice-link-payment-guide": {
    title: "How to pay your OCCTA bill",
    url: `${APP_BASE}/help/pay-by-bank-transfer`,
    summary: "Direct Debit or bank transfer: our bank details and the reference to use.",
  },
  "what-to-do-if-your-card-payment-fails": {
    title: "Missed a payment or finding it hard to pay?",
    url: `${APP_BASE}/help/missed-payment-help`,
    summary: "How to put a missed payment right, and the help we can offer.",
  },
};

export async function fetchHelpfulLinks(
  supabase: any,
  templateKey: string,
  opts: { max?: number } = {},
): Promise<HelpfulLink[]> {
  try {
    const max = Math.max(1, Math.min(4, opts.max ?? 3));
    const { data: maps } = await supabase
      .from("email_template_help_links")
      .select("article_slug, display_order")
      .eq("template_key", templateKey)
      .order("display_order", { ascending: true })
      .limit(max);
    const slugs = (maps ?? []).map((m: any) => m.article_slug).filter(Boolean);
    if (!slugs.length) return [];
    const { data: articles } = await supabase
      .from("kb_articles")
      .select("slug, title, summary, kind, status, visibility")
      .in("slug", slugs)
      .eq("status", "approved")
      .eq("visibility", "public");
    const bySlug = new Map<string, any>();
    for (const a of articles ?? []) bySlug.set(a.slug, a);
    const out: HelpfulLink[] = [];
    const seen = new Set<string>();
    for (const s of slugs) {
      const retired = RETIRED_ARTICLE_REPLACEMENTS[s];
      const a = bySlug.get(s);
      const link = retired ?? (a ? { title: a.title, url: slugToPath(a.slug, a.kind), summary: a.summary } : null);
      if (!link || seen.has(link.url)) continue;
      seen.add(link.url);
      out.push(link);
      if (out.length >= max) break;
    }
    return out;
  } catch (_e) {
    return [];
  }
}

/**
 * "Helpful reading" card. Whole rows are tappable. Pass inset:true when it is
 * dropped straight into a 600px email card (send-email's footer slot) so it
 * gets the same 28px side padding as the content above it.
 */
export function renderHelpfulLinksBlock(links: HelpfulLink[], opts: { inset?: boolean } = {}): string {
  if (!links.length) return "";
  const font = "font-family:Helvetica,Arial,sans-serif;";
  const items = links.map((l, i) => `
          <tr><td style="padding:0;${i ? "border-top:1px solid #e6e6df;" : ""}">
            <a href="${esc(l.url)}" style="display:block;padding:14px 18px;text-decoration:none;color:#0d0d0d;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="${font}">
                  <div style="font-size:15px;line-height:21px;font-weight:bold;color:#0d0d0d;">${esc(l.title)}</div>
                  ${l.summary ? `<div style="font-size:13px;line-height:19px;color:#555555;padding-top:3px;">${esc(l.summary)}</div>` : ""}
                </td>
                <td width="28" align="right" valign="middle" style="${font}font-size:18px;font-weight:bold;color:#0d0d0d;">&rsaquo;</td>
              </tr></table>
            </a>
          </td></tr>`).join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:${opts.inset ? "4px 28px 28px" : "16px 0 4px"};">
        <div style="${font}font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#666666;padding:0 0 10px 2px;">Helpful reading</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e6df;border-radius:8px;border-collapse:separate;background:#ffffff;">${items}
        </table>
      </td></tr>
    </table>`;
}

/** Convenience: fetch + render in one call. Returns "" on empty / error. */
export async function fetchHelpfulLinksHtml(
  supabase: any,
  templateKey: string,
  opts: { max?: number; inset?: boolean } = {},
): Promise<string> {
  const links = await fetchHelpfulLinks(supabase, templateKey, opts);
  return renderHelpfulLinksBlock(links, { inset: opts.inset });
}