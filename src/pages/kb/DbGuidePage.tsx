import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import KbArticleView, { type KbArticle } from "@/components/kb/KbArticleView";
import NotFound from "@/pages/NotFound";
import Layout from "@/components/layout/Layout";
import GuidePage from "@/pages/guides/GuidePage";
import { guides } from "@/data/guides";

/**
 * /guides/:slug — prefers static guides data, falls back to database. Any DB
 * article of kind 'guide' or 'help' can be rendered here.
 */
export default function DbGuidePage() {
  const { slug } = useParams();
  const isStatic = slug ? guides.some((g) => g.slug === slug) : false;
  const [state, setState] = useState<KbArticle | "loading" | "notfound">(isStatic ? "notfound" : "loading");

  useEffect(() => {
    if (isStatic) return;
    if (!slug) { setState("notfound"); return; }
    (async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("id, slug, title, summary, content, kind, seo_title, seo_description, tags, hero_image_url, read_minutes, last_reviewed_at, structured_data, related_slugs")
        .eq("slug", slug)
        .in("kind", ["guide", "help"])
        .eq("visibility", "public")
        .eq("status", "approved")
        .maybeSingle();
      if (error || !data) { setState("notfound"); return; }
      const related_slugs = (data.related_slugs as string[]) ?? [];
      const related = related_slugs.length
        ? (await supabase.from("kb_articles").select("slug, title, kind").in("slug", related_slugs).eq("status", "approved").eq("visibility", "public")).data ?? []
        : [];
      const structured = (data.structured_data as Record<string, unknown> | null) ?? null;
      const faqs = structured && Array.isArray((structured as { faqs?: unknown }).faqs) ? ((structured as { faqs: { question: string; answer: string }[] }).faqs) : [];
      setState({ ...data, related, faqs } as unknown as KbArticle);
    })();
  }, [slug, isStatic]);

  if (isStatic) return <GuidePage />;
  if (state === "loading") return <Layout><div className="container mx-auto p-12 text-muted-foreground">Loading…</div></Layout>;
  if (state === "notfound") return <NotFound />;
  return <KbArticleView article={state} />;
}