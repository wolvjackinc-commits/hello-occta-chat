-- Extend kb_articles with additional editorial + SEO fields
ALTER TABLE public.kb_articles
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'help',
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_slugs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS structured_data jsonb,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS ai_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS read_minutes integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_articles_kind_check'
  ) THEN
    ALTER TABLE public.kb_articles
      ADD CONSTRAINT kb_articles_kind_check CHECK (kind IN ('help','guide','blog'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_articles_audience_check'
  ) THEN
    ALTER TABLE public.kb_articles
      ADD CONSTRAINT kb_articles_audience_check CHECK (audience IN ('public','customer'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kb_articles_kind_status_visibility
  ON public.kb_articles (kind, status, visibility);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tags
  ON public.kb_articles USING GIN (tags);

-- Article feedback
CREATE TABLE IF NOT EXISTS public.help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  note text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.help_article_feedback TO anon, authenticated;
GRANT SELECT ON public.help_article_feedback TO authenticated;
GRANT ALL ON public.help_article_feedback TO service_role;
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert kb feedback" ON public.help_article_feedback FOR INSERT
  WITH CHECK (true);
CREATE POLICY "staff read kb feedback" ON public.help_article_feedback FOR SELECT TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Search logs
CREATE TABLE IF NOT EXISTS public.help_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  results_count integer NOT NULL DEFAULT 0,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.help_search_logs TO anon, authenticated;
GRANT SELECT ON public.help_search_logs TO authenticated;
GRANT ALL ON public.help_search_logs TO service_role;
ALTER TABLE public.help_search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert search log" ON public.help_search_logs FOR INSERT
  WITH CHECK (true);
CREATE POLICY "staff read search logs" ON public.help_search_logs FOR SELECT TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_help_search_logs_created_at ON public.help_search_logs (created_at DESC);

-- Email template to help article links
CREATE TABLE IF NOT EXISTS public.email_template_help_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  article_slug text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_template_help_links TO authenticated;
GRANT ALL ON public.email_template_help_links TO service_role;
ALTER TABLE public.email_template_help_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read template links" ON public.email_template_help_links FOR SELECT TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "staff manage template links" ON public.email_template_help_links FOR ALL TO authenticated
  USING (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_compliance_access(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_email_template_help_links_key ON public.email_template_help_links (template_key);

-- Safe read RPCs
CREATE OR REPLACE FUNCTION public.get_kb_articles_by_kind(_kind text)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  summary text,
  kind text,
  tags text[],
  hero_image_url text,
  read_minutes integer,
  last_reviewed_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, title, summary, kind, tags, hero_image_url, read_minutes, last_reviewed_at, updated_at
  FROM public.kb_articles
  WHERE kind = _kind
    AND visibility = 'public'
    AND status = 'approved'
    AND audience = 'public'
  ORDER BY updated_at DESC
  LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.get_kb_articles_by_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kb_articles_by_kind(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_public_kb(_q text, _kind text DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  summary text,
  kind text,
  tags text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q text := trim(coalesce(_q, ''));
  pattern text;
  result_rows int;
BEGIN
  IF length(q) < 2 THEN
    RETURN;
  END IF;
  pattern := '%' || q || '%';

  RETURN QUERY
  SELECT a.id, a.slug, a.title, a.summary, a.kind, a.tags
  FROM public.kb_articles a
  WHERE a.visibility = 'public'
    AND a.status = 'approved'
    AND a.audience = 'public'
    AND (_kind IS NULL OR a.kind = _kind)
    AND (a.title ILIKE pattern OR a.summary ILIKE pattern OR a.content ILIKE pattern OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE t ILIKE pattern))
  ORDER BY
    (CASE WHEN a.title ILIKE pattern THEN 0 ELSE 1 END),
    a.updated_at DESC
  LIMIT LEAST(coalesce(_limit, 20), 50);

  GET DIAGNOSTICS result_rows = ROW_COUNT;
  INSERT INTO public.help_search_logs (query, results_count, user_id)
  VALUES (q, result_rows, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.search_public_kb(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_kb(text, text, integer) TO anon, authenticated;

-- AI retrieval helper: returns articles that AI is allowed to cite, filtered by audience.
CREATE OR REPLACE FUNCTION public.search_kb_for_ai(_q text, _include_customer boolean DEFAULT false, _limit integer DEFAULT 6)
RETURNS TABLE (
  slug text,
  title text,
  summary text,
  kind text,
  content text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q text := trim(coalesce(_q, ''));
  pattern text;
BEGIN
  IF length(q) < 2 THEN RETURN; END IF;
  pattern := '%' || q || '%';
  RETURN QUERY
  SELECT a.slug, a.title, a.summary, a.kind, a.content
  FROM public.kb_articles a
  WHERE a.visibility = 'public'
    AND a.status = 'approved'
    AND a.ai_allowed = true
    AND (a.audience = 'public' OR (_include_customer AND a.audience = 'customer'))
    AND (a.title ILIKE pattern OR a.summary ILIKE pattern OR a.content ILIKE pattern OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE t ILIKE pattern))
  ORDER BY (CASE WHEN a.title ILIKE pattern THEN 0 ELSE 1 END), a.updated_at DESC
  LIMIT LEAST(coalesce(_limit, 6), 20);
END $$;
REVOKE ALL ON FUNCTION public.search_kb_for_ai(text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_kb_for_ai(text, boolean, integer) TO anon, authenticated, service_role;
