ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS network_validation_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.customer_journey_sessions
  DROP CONSTRAINT IF EXISTS customer_journey_sessions_network_validation_status_chk;
ALTER TABLE public.customer_journey_sessions
  ADD CONSTRAINT customer_journey_sessions_network_validation_status_chk
  CHECK (network_validation_status IN ('pending','verified','failed'));
COMMENT ON COLUMN public.customer_journey_sessions.network_validation_status IS
  'Supplier-neutral network validation state. Binding broadband documents require verified occta-network-evidence-v1 in supplier_availability_snapshot.';

CREATE OR REPLACE FUNCTION public.sync_network_validation_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.supplier_availability_snapshot IS NOT NULL
     AND NEW.supplier_availability_snapshot->>'evidence_version' = 'occta-network-evidence-v1'
     AND NEW.supplier_availability_snapshot->>'verified' = 'true'
     AND NEW.supplier_availability_sha256 ~ '^[0-9a-f]{64}$' THEN
    NEW.network_validation_status := 'verified';
  ELSIF NEW.network_validation_status = 'verified' THEN
    NEW.network_validation_status := 'pending';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_network_validation_status ON public.customer_journey_sessions;
CREATE TRIGGER trg_sync_network_validation_status
  BEFORE INSERT OR UPDATE OF supplier_availability_snapshot, supplier_availability_sha256, network_validation_status
  ON public.customer_journey_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sync_network_validation_status();