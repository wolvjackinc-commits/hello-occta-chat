
-- Tighten platform_settings access: remove broad authenticated SELECT.
-- Non-admin reads must go through public.platform_settings_public (view) or RPCs.

DROP POLICY IF EXISTS platform_settings_authenticated_read_safe ON public.platform_settings;

-- Revoke any direct grants on the raw table from anon/authenticated.
REVOKE SELECT ON public.platform_settings FROM anon;
REVOKE SELECT ON public.platform_settings FROM authenticated;

-- Ensure the safe public view remains readable by clients.
GRANT SELECT ON public.platform_settings_public TO anon, authenticated;

-- Tag leftover internal test quote requests so they are not processed.
UPDATE public.quote_requests
SET message = '[INTERNAL TEST — DO NOT PROCESS] ' || COALESCE(message, ''),
    updated_at = now()
WHERE reference IN ('QR-2606-e1c00750','QR-2606-81037f8b')
  AND COALESCE(message, '') NOT LIKE '[INTERNAL TEST%';
