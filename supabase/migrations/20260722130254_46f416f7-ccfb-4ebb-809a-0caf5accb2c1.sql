DROP POLICY IF EXISTS "chat_att_guest_insert" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can submit a business lead" ON public.business_leads;
CREATE POLICY "Anyone can submit a business lead"
ON public.business_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(company_name)) BETWEEN 2 AND 200
  AND length(btrim(contact_name)) BETWEEN 2 AND 200
  AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  AND (phone IS NULL OR length(btrim(phone)) BETWEEN 7 AND 40)
  AND site_count BETWEEN 1 AND 250
  AND cardinality(services) <= 20
  AND (message IS NULL OR length(message) <= 5000)
  AND (source IS NULL OR length(source) <= 120)
  AND status = 'new'
  AND assigned_to IS NULL
  AND internal_notes IS NULL
);

DROP POLICY IF EXISTS "Anyone can submit quote requests" ON public.business_quote_requests;
CREATE POLICY "Anyone can submit quote requests"
ON public.business_quote_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(company_name)) BETWEEN 2 AND 200
  AND length(btrim(contact_name)) BETWEEN 2 AND 200
  AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  AND (phone IS NULL OR length(btrim(phone)) BETWEEN 7 AND 40)
  AND site_count BETWEEN 1 AND 250
  AND cardinality(services) <= 20
  AND (message IS NULL OR length(message) <= 5000)
  AND jsonb_typeof(requirements) = 'object'
  AND status = 'new'
  AND assigned_to IS NULL
  AND internal_notes IS NULL
);