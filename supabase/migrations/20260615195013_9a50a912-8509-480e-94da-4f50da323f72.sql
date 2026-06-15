DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_requests TO authenticated';
  EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.quote_requests TO service_role';
END $$;