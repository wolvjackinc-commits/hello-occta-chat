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

export async function fetchHelpfulLinks(
  supabase: any,
  templateKey: string,
  opts: { max?: number } = {},
): Promise<HelpfulLink[]> {
  try {
    const max = Math.max(1, Math.min(4, opts.max ?? 3));
    const { data: maps } = await supabase
      .from("email_template_help_links")
      .select("article_slug, sort_order")
      .eq("template_key", templateKey)
      .order("sort_order", { ascending: true })
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
    for (const s of slugs) {
      const a = bySlug.get(s);
      if (!a) continue;
      out.push({ title: a.title, url: slugToPath(a.slug, a.kind), summary: a.summary });
      if (out.length >= max) break;
    }
    return out;
  } catch (_e) {
    return [];
  }
}

/** Brutalist card of helpful links, matching brutalistEmailShell aesthetics. */
export function renderHelpfulLinksBlock(links: HelpfulLink[]): string {
  if (!links.length) return "";
  const items = links.map((l) => `
    <tr><td style="padding:8px 0;border-top:1px solid #eee;">
      <a href="${esc(l.url)}" style="display:block;font:600 14px/1.4 Arial,Helvetica,sans-serif;color:#111;text-decoration:none;">${esc(l.title)} →</a>
      ${l.summary ? `<div style="font:12px/1.5 Arial,Helvetica,sans-serif;color:#555;margin-top:2px;">${esc(l.summary)}</div>` : ""}
    </td></tr>`).join("");
  return `
    <div style="margin:22px 0 4px 0;padding:16px 18px;border:2px solid #111;background:#fafafa;">
      <div style="font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#666;margin:0 0 6px 0;">Helpful reading</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${items}</table>
    </div>`;
}

/** Convenience: fetch + render in one call. Returns "" on empty / error. */
export async function fetchHelpfulLinksHtml(
  supabase: any,
  templateKey: string,
  opts: { max?: number } = {},
): Promise<string> {
  const links = await fetchHelpfulLinks(supabase, templateKey, opts);
  return renderHelpfulLinksBlock(links);
}