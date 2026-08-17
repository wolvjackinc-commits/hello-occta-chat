
DO $$
DECLARE
  v_customer_id UUID := '67ac9cf4-f5f6-4df3-9e42-523899d71cdf';
  v_recipient_email TEXT := 'phoenixs83@yahoo.com';
  v_full_name TEXT := 'Corrina Marie Hughes';
BEGIN
  INSERT INTO public.communications_log (
    user_id,
    recipient_email,
    subject,
    body_html,
    status,
    template_name,
    metadata,
    sent_at
  ) VALUES (
    v_customer_id,
    v_recipient_email,
    'Router Delivery Update - OCC06467058',
    '<div style="font-family: sans-serif; line-height: 1.6; color: #333;">' ||
    '<p>Hello ' || v_full_name || ',</p>' ||
    '<p>We apologize for any inconvenience caused. Your router is scheduled to be delivered tomorrow, 18th August.</p>' ||
    '<p><strong>Tracking Information:</strong><br>' ||
    'Consignment / Tracking Number: <strong>0253912</strong><br>' ||
    'Tracking Link: <a href="https://apcchoice.apc-overnight.com/APCChoice" style="color: #0066cc;">https://apcchoice.apc-overnight.com/APCChoice</a></p>' ||
    '<p>Best regards,<br>OCCTA Team</p>' ||
    '</div>',
    'sent',
    'custom_admin',
    jsonb_build_object(
      'tracking_number', '0253912',
      'delivery_date', '2026-08-18',
      'manual_remediation', true
    ),
    NOW()
  );
END $$;
