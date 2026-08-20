
UPDATE public.invoices 
SET 
    total = 141.01,
    subtotal = 117.51,
    vat_total = 23.50,
    notes = 'First payment: £79.99 router, £18.03 pro-rata (19-31 Aug), £42.99 Sept advance.',
    pro_rata = jsonb_build_object(
        'is_pro_rata', true,
        'billable_days', 13,
        'amount_minor', 1803,
        'monthly_minor', 4299,
        'one_off_charges_minor', 7999,
        'advance_payment_minor', 4299,
        'total_gross_minor', 14101
    ),
    updated_at = NOW(),
    pdf_generated_at = NULL
WHERE id = '0324ab8c-8758-4493-b564-0c93ebb02ff2';

INSERT INTO public.communications_log (
    user_id,
    recipient_email,
    subject,
    body_html,
    status,
    template_name,
    sent_at
) VALUES (
    '67ac9cf4-f5f6-4df3-9e42-523899d71cdf',
    'phoenixs83@yahoo.com',
    'Internal Log: Billing Correction OCC06467058',
    'First payment corrected to £141.01 (Router + Pro-rata + Advance Sept).',
    'sent',
    'custom_admin',
    NOW()
);
