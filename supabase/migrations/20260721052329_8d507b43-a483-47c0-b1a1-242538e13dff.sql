
ALTER TABLE public.communications_log
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_communications_log_opened_at
  ON public.communications_log(opened_at DESC) WHERE opened_at IS NOT NULL;
