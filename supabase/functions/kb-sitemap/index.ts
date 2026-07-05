// Public sitemap fragment listing approved KB articles (help / guide / blog).
// Referenced from robots.txt so crawlers can discover DB-authored articles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const BASE_URL = "https://www.occta.co.uk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client
      .from("kb_articles")
      .select("slug, kind, updated_at")
      .eq("visibility", "public")
      .eq("status", "approved")
      .eq("audience", "public");
    if (error) throw error;

    const urls = (data ?? []).map((row: { slug: string; kind: string; updated_at: string }) => {
      const path = row.kind === "blog" ? `/blog/${row.slug}` : row.kind === "guide" ? `/guides/${row.slug}` : `/help/${row.slug}`;
      const lastmod = row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : "";
      return `  <url><loc>${BASE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
    return new Response(xml, {
      status: 200,
      headers: { ...cors, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
    });
  } catch (err) {
    return new Response(`error: ${(err as Error).message}`, { status: 500, headers: cors });
  }
});