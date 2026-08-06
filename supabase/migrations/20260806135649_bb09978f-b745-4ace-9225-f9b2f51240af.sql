CREATE TABLE IF NOT EXISTS public.dd_encryption_migration_switch (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  armed boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.dd_encryption_migration_switch TO service_role;

ALTER TABLE public.dd_encryption_migration_switch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.dd_encryption_migration_switch
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.dd_encryption_migration_switch (id, armed)
VALUES (true, true)
ON CONFLICT (id) DO UPDATE SET armed = true, updated_at = now();