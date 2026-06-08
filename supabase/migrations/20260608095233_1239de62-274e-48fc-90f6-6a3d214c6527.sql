
CREATE OR REPLACE FUNCTION public.points_ledger_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger is append-only';
END;
$$;
