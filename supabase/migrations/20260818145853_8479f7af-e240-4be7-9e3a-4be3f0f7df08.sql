UPDATE public.communications_log
SET status = 'failed',
    error_message = COALESCE(error_message,'') || 'Logged without provider dispatch — no email was actually delivered. Superseded by the 18 Aug 2026 router tracking email.'
WHERE id = '6c80356a-7b43-4ce6-ac0b-298658d40353';