-- Create a function that calls the dd-status-notify edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_dd_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGdqbXV2Z2RuZGl6c3VmaXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Nzk5NDksImV4cCI6MjA4MzI1NTk0OX0.GnviK6x-kwCSFww-Wa4fcCtQGOQ1iMx8rZTrrU46Pto';
  payload jsonb;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    payload := jsonb_build_object(
      'mandateId', NEW.id,
      'newStatus', NEW.status,
      'oldStatus', OLD.status,
      'userId', NEW.user_id
    );
    
    -- Call the edge function via pg_net
    PERFORM net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/dd-status-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on dd_mandates for status changes
DROP TRIGGER IF EXISTS trigger_dd_status_notify ON public.dd_mandates;
CREATE TRIGGER trigger_dd_status_notify
  AFTER UPDATE ON public.dd_mandates
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dd_status_change();