CREATE TABLE public.journey2_test_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_sha256 text NOT NULL UNIQUE,
  uses_remaining integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.journey2_test_tickets TO service_role;

ALTER TABLE public.journey2_test_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to journey2 test tickets"
ON public.journey2_test_tickets FOR SELECT TO authenticated USING (false);

INSERT INTO public.journey2_test_tickets (token_sha256, uses_remaining, expires_at, note)
VALUES ('6d5932e38eabd88e61854b71da5f84900e5114cf6ea3914124d35119f42d4433', 6, now() + interval '12 hours', 'automated journey2 isolated test + preflight verification');