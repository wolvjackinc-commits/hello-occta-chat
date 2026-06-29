
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS conversion_page TEXT;

CREATE INDEX IF NOT EXISTS idx_quote_requests_gclid ON public.quote_requests(gclid) WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_utm_campaign ON public.quote_requests(utm_campaign) WHERE utm_campaign IS NOT NULL;
