
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS two_document_contract_flow_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_settings.two_document_contract_flow_enabled IS
  'Phase B/C compliance feature flag. When true, new orders use the two-document acceptance flow (Contract Summary + Contract Information Pack) with service-aware snapshots and hard-block validators. Legacy accepted documents are never affected regardless of this flag.';
