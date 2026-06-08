
-- Customer-only RPCs: authenticated only
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.get_customer_tickets()',
    'public.get_customer_ticket_messages(uuid)',
    'public.get_customer_complaints()',
    'public.get_customer_complaint_events(uuid)',
    'public.get_customer_communication_threads()',
    'public.get_customer_communication_messages(uuid)',
    'public.get_customer_complaint_letters()',
    'public.customer_create_ticket(text,text,text,text,boolean)',
    'public.customer_add_ticket_message(uuid,text)',
    'public.customer_create_complaint(text,text,text,text,text)'
  ]) LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || fn || ' FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION ' || fn || ' FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || fn || ' TO authenticated';
  END LOOP;
END $$;

-- Public KB stays callable by anon
REVOKE ALL ON FUNCTION public.get_public_kb_articles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_kb_articles() TO anon, authenticated;

-- Internal helper functions: service_role only
REVOKE ALL ON FUNCTION public.generate_complaint_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_complaint_reference() FROM anon, authenticated;
