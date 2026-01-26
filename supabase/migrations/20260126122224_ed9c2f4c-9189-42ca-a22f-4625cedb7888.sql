-- Add provider_reference column to dd_mandates for storing the provider's mandate ID
ALTER TABLE public.dd_mandates 
ADD COLUMN IF NOT EXISTS provider_reference text;

-- Add index for faster lookups by provider reference
CREATE INDEX IF NOT EXISTS idx_dd_mandates_provider_reference 
ON public.dd_mandates(provider_reference) 
WHERE provider_reference IS NOT NULL;