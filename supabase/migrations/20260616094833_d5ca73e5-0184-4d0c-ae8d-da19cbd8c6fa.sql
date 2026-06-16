-- Phase D: cooling-off + early-start waiver fields
ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS early_start_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_start_waived_at timestamptz,
  ADD COLUMN IF NOT EXISTS early_start_waiver_text text,
  ADD COLUMN IF NOT EXISTS early_start_waiver_text_hash text,
  ADD COLUMN IF NOT EXISTS early_start_waiver_ip text,
  ADD COLUMN IF NOT EXISTS cooling_off_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooling_off_acknowledged_at timestamptz;

-- Auto-populate cooling_off_ends_at = contract_accepted_at + 14 days when acceptance lands,
-- if not already set. Idempotent.
CREATE OR REPLACE FUNCTION public.set_journey_cooling_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_accepted_at IS NOT NULL
     AND (OLD.contract_accepted_at IS NULL OR OLD.contract_accepted_at IS DISTINCT FROM NEW.contract_accepted_at)
     AND NEW.cooling_off_ends_at IS NULL THEN
    NEW.cooling_off_ends_at := NEW.contract_accepted_at + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_journey_cooling_off ON public.order_journeys;
CREATE TRIGGER trg_set_journey_cooling_off
  BEFORE UPDATE ON public.order_journeys
  FOR EACH ROW EXECUTE FUNCTION public.set_journey_cooling_off();

-- Also handle the insert case (rare — journeys normally update to accept)
CREATE OR REPLACE FUNCTION public.set_journey_cooling_off_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_accepted_at IS NOT NULL AND NEW.cooling_off_ends_at IS NULL THEN
    NEW.cooling_off_ends_at := NEW.contract_accepted_at + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_journey_cooling_off_ins ON public.order_journeys;
CREATE TRIGGER trg_set_journey_cooling_off_ins
  BEFORE INSERT ON public.order_journeys
  FOR EACH ROW EXECUTE FUNCTION public.set_journey_cooling_off_ins();