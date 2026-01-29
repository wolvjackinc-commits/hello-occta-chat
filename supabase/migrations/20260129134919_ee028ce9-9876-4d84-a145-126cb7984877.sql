-- Create function to anonymize old account deletion records
-- Keeps audit trail but removes PII after 90 days retention period
CREATE OR REPLACE FUNCTION public.anonymize_old_account_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  -- Anonymize records older than 90 days that haven't been anonymized yet
  UPDATE public.account_deletions
  SET 
    email = 'anonymized-' || SUBSTRING(id::text, 1, 8) || '@deleted.local',
    full_name = 'Deleted User',
    account_number = NULL
  WHERE 
    deleted_at < NOW() - INTERVAL '90 days'
    AND email NOT LIKE 'anonymized-%@deleted.local';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Log the anonymization action
  IF rows_updated > 0 THEN
    INSERT INTO public.audit_logs (actor_user_id, action, entity, metadata)
    VALUES (
      NULL,
      'anonymize_deleted_accounts',
      'account_deletions',
      jsonb_build_object('records_anonymized', rows_updated, 'retention_days', 90)
    );
  END IF;
  
  RETURN rows_updated;
END;
$$;

-- Schedule daily cleanup using pg_cron (runs at 3 AM UTC)
SELECT cron.schedule(
  'anonymize-account-deletions',
  '0 3 * * *',
  $$SELECT public.anonymize_old_account_deletions()$$
);

-- Add comment for documentation
COMMENT ON FUNCTION public.anonymize_old_account_deletions() IS 
'GDPR compliance: Anonymizes PII in account_deletions after 90-day retention period. 
Preserves audit trail (original_user_id, deleted_at, deleted_by, reason) while removing 
email, full_name, and account_number.';