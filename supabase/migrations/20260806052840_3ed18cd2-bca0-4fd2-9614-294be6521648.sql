CREATE OR REPLACE FUNCTION public.guard_profiles_customer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff and internal (service_role / trigger-driven) updates are unrestricted.
  IF auth.uid() IS NULL OR public.has_any_admin_role(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- A customer editing their own profile may not touch admin-controlled columns.
  IF auth.uid() = OLD.id THEN
    NEW.id                  := OLD.id;
    NEW.suspended_at        := OLD.suspended_at;
    NEW.archived_at         := OLD.archived_at;
    NEW.archived_reason     := OLD.archived_reason;
    NEW.admin_notes         := OLD.admin_notes;
    NEW.account_type        := OLD.account_type;
    NEW.business_vat_number := OLD.business_vat_number;
    NEW.company_number      := OLD.company_number;
    NEW.account_number      := OLD.account_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profiles_customer_update_trg ON public.profiles;
CREATE TRIGGER guard_profiles_customer_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_customer_update();