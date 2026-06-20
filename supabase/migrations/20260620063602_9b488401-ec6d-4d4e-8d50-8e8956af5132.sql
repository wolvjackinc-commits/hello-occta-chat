
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS extra_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS speed_disclaimer text,
  ADD COLUMN IF NOT EXISTS revision_of_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_parent ON public.quotes(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_revision_of ON public.quotes(revision_of_quote_id);
