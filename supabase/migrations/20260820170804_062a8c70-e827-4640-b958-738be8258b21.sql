
-- Billing correction and re-issue for Ms Corrina Marie Hughes (OCC06467058)
DO $$
DECLARE
    v_user_id UUID := '67ac9cf4-f5f6-4df3-9e42-523899d71cdf';
    v_old_inv_id UUID := '0324ab8c-8758-4493-b564-0c93ebb02ff2';
    v_new_inv_id UUID := gen_random_uuid();
    v_total NUMERIC := 141.01;
    v_subtotal NUMERIC := 117.51;
    v_vat NUMERIC := 23.50;
    v_body_html TEXT;
BEGIN
    -- 1. Cancel the incorrect invoice
    UPDATE public.invoices 
    SET status = 'cancelled', notes = 'Cancelled in favour of INV-2608-0004 due to first payment amount correction.'
    WHERE id = v_old_inv_id;

    -- 2. Create the new correct invoice
    INSERT INTO public.invoices (
        id,
        user_id,
        invoice_number,
        invoice_type,
        status,
        issue_date,
        due_date,
        subtotal,
        vat_total,
        total,
        vat_enabled,
        vat_rate,
        currency,
        notes,
        pro_rata
    ) VALUES (
        v_new_inv_id,
        v_user_id,
        'INV-2608-0004',
        'first_pro_rata',
        'issued',
        CURRENT_DATE,
        '2026-09-03',
        v_subtotal,
        v_vat,
        v_total,
        true,
        20,
        'GBP',
        'Corrected first payment: £79.99 router, £18.03 pro-rata (19-31 Aug), £42.99 Sept advance.',
        jsonb_build_object(
            'is_pro_rata', true,
            'billable_days', 13,
            'amount_minor', 1803,
            'monthly_minor', 4299,
            'one_off_charges_minor', 7999,
            'advance_payment_minor', 4299,
            'total_gross_minor', 14101
        )
    );

    -- 3. Prepare and Send Correction Email
    v_body_html := '<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 4px solid #000; padding: 20px;">' ||
                   '<h1 style="font-size: 24px; text-transform: uppercase; border-bottom: 4px solid #000; padding-bottom: 10px; margin-top: 0;">Important: Invoice Correction</h1>' ||
                   '<p>Hello Corrina,</p>' ||
                   '<p>Please <strong>ignore the previous invoice (INV-2608-0003)</strong> sent earlier today. We identified a calculation error regarding your first payment total.</p>' ||
                   '<p>Your correct first collection amount is <strong>£141.01</strong>, which will be collected via Direct Debit on <strong>1 September 2026</strong>. This covers:</p>' ||
                   '<ul>' ||
                   '<li><strong>£79.99</strong> — One-off router charge</li>' ||
                   '<li><strong>£18.03</strong> — Pro-rata broadband (19–31 Aug)</li>' ||
                   '<li><strong>£42.99</strong> — Regular September advance payment</li>' ||
                   '</ul>' ||
                   '<p>The new invoice <strong>INV-2608-0004</strong> is now available in your dashboard. We apologize for the confusion.</p>' ||
                   '<p style="margin-top: 20px; font-weight: bold;">OCCTA LIMITED</p>' ||
                   '<p style="font-size: 12px; color: #666;">Simple telecom. Clear terms.</p>' ||
                   '</div>';

    INSERT INTO public.communications_log (
        user_id,
        recipient_email,
        subject,
        body_html,
        status,
        template_name,
        sent_at
    ) VALUES (
        v_user_id,
        'phoenixs83@yahoo.com',
        'Important: Corrected Invoice for OCC06467058',
        v_body_html,
        'sent',
        'custom_admin',
        NOW()
    );
END $$;
