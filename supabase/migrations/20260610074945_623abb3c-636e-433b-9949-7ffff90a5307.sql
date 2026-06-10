
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS network text,
  ADD COLUMN IF NOT EXISTS download_speed_mbps integer,
  ADD COLUMN IF NOT EXISTS upload_speed_mbps integer,
  ADD COLUMN IF NOT EXISTS min_term_months integer,
  ADD COLUMN IF NOT EXISTS connection_fee_net numeric(12,4),
  ADD COLUMN IF NOT EXISTS migration_fee_net numeric(12,4),
  ADD COLUMN IF NOT EXISTS care_level text,
  ADD COLUMN IF NOT EXISTS care_level_uplift_net numeric(12,4),
  ADD COLUMN IF NOT EXISTS router_compatible text,
  ADD COLUMN IF NOT EXISTS router_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS router_notes text,
  ADD COLUMN IF NOT EXISTS etf_applies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disconnect_fee_in_12m_net numeric(12,4),
  ADD COLUMN IF NOT EXISTS disconnect_fee_after_12m_net numeric(12,4),
  ADD COLUMN IF NOT EXISTS quote_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bucket_hint text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_document text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS source_section text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_products_bucket_hint_chk') THEN
    ALTER TABLE public.supplier_products
      ADD CONSTRAINT supplier_products_bucket_hint_chk
      CHECK (bucket_hint IS NULL OR bucket_hint IN ('essential','superfast','ultrafast','gigabit'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS supplier_products_active_bucket_idx
  ON public.supplier_products (active, bucket_hint) WHERE active = true;
CREATE INDEX IF NOT EXISTS supplier_products_supplier_idx
  ON public.supplier_products (supplier_id);

INSERT INTO public.supplier_profiles (supplier_name, supplier_type, status, api_mode, reverse_charge_possible, vat_treatment_notes, notes)
SELECT 'Giacom', 'broadband', 'active', 'manual'::public.supplier_api_mode, false,
       'Standard VAT 20% on broadband supply',
       'Auto-created for Phase 3D Giacom Broadband Ratecard import'
WHERE NOT EXISTS (SELECT 1 FROM public.supplier_profiles WHERE supplier_name = 'Giacom');
