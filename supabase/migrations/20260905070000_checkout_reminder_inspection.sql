CREATE OR REPLACE FUNCTION public.admin_checkout_inspection(_source text, _session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _delay integer;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_staff(auth.uid()), false) THEN
    RAISE EXCEPTION 'staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT greatest(5, coalesce(customer_journey_v2_resume_delay_minutes, 60))
    INTO _delay FROM public.platform_settings WHERE singleton = true;
  IF _source = 'journey2' THEN
    SELECT jsonb_build_object(
      'inactivity_minutes', coalesce(_delay, 60),
      'attribution', jsonb_build_object(
        'utm_source', s.utm_snapshot->>'utm_source',
        'utm_medium', s.utm_snapshot->>'utm_medium',
        'utm_campaign', s.utm_snapshot->>'utm_campaign',
        'google_click_recorded', nullif(s.utm_snapshot->>'gclid', '') IS NOT NULL
      ),
      'reminders', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'number', r.reminder_number, 'subject', r.subject,
          'status', r.status, 'queued_at', r.queued_at,
          'worker_sent_at', CASE WHEN r.status = 'sent' THEN r.delivered_at END,
          'failed_at', r.failed_at, 'error', r.last_error,
          'attempts', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', c.id, 'recipient', c.recipient_email, 'subject', c.subject,
              'body_html', c.body_html, 'status', c.status, 'sent_at', c.sent_at,
              'delivered_at', c.delivered_at, 'opened_at', c.opened_at,
              'last_opened_at', c.last_opened_at, 'open_count', c.open_count,
              'error', c.error_message, 'created_at', c.created_at
            ) ORDER BY c.created_at, c.id)
            FROM public.communications_log c
            WHERE c.metadata->>'session_id' = s.id::text
              AND c.metadata->>'reminder_number' = r.reminder_number::text
              AND c.template_name = 'journey2_checkout_reminder_' || r.reminder_number::text
          ), '[]'::jsonb)
        ) ORDER BY r.reminder_number)
        FROM public.checkout_reminders r WHERE r.journey_session_id = s.id
      ), '[]'::jsonb)
    ) INTO _result
    FROM public.customer_journey_sessions s
    WHERE s.id = _session_id AND NOT coalesce(s.test_session, false);
  ELSIF _source = 'web' THEN
    SELECT jsonb_build_object('inactivity_minutes', coalesce(_delay, 60),
      'attribution', '{}'::jsonb, 'reminders', '[]'::jsonb)
      INTO _result FROM public.checkout_tracking_sessions w
      WHERE w.id = _session_id AND w.journey_session_id IS NULL;
  ELSE
    RAISE EXCEPTION 'invalid checkout source' USING ERRCODE = '22023';
  END IF;
  IF _result IS NULL THEN
    RAISE EXCEPTION 'checkout session not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_checkout_inspection(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_checkout_inspection(text, uuid) TO authenticated;
