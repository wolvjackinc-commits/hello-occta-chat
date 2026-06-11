UPDATE public.quotes
SET status='expired'::public.quote_status_kind, updated_at=now()
WHERE id='4206e67e-e8bb-4f0d-a038-6d8e275723da';

UPDATE public.quotes
SET status='approved'::public.quote_status_kind, approved_at=now(), updated_at=now()
WHERE id='840e80ae-1f45-4ba0-9731-90d05e3d64fc';

UPDATE public.quote_requests
SET final_quote_id='840e80ae-1f45-4ba0-9731-90d05e3d64fc',
    status='final_quote_ready'::public.quote_request_status,
    updated_at=now()
WHERE id='4af5050a-3ed8-4511-b33f-f79bc06f8dd1';