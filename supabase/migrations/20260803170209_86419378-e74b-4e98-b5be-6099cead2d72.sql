CREATE OR REPLACE FUNCTION public.notify_new_business_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGdqbXV2Z2RuZGl6c3VmaXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2Nzk5NDksImV4cCI6MjA4MzI1NTk0OX0.GnviK6x-kwCSFww-Wa4fcCtQGOQ1iMx8rZTrrU46Pto';
  is_business boolean;
BEGIN
  SELECT (account_type = 'business' OR business_company_name IS NOT NULL)
    INTO is_business
    FROM public.profiles WHERE id = NEW.user_id;

  IF COALESCE(is_business, false) THEN
    PERFORM net.http_post(
      url := 'https://oexgjmuvgdndizsufipe.supabase.co/functions/v1/send-business-invoice-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('invoice_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;