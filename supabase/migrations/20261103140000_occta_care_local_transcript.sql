-- Sales Desk: recordings are transcribed on the agent's computer (open-source
-- speech model in the browser), then scored by Claude. Record that source.
ALTER TABLE public.care_sales DROP CONSTRAINT IF EXISTS care_sales_transcript_source_check;
ALTER TABLE public.care_sales ADD CONSTRAINT care_sales_transcript_source_check
  CHECK (transcript_source IS NULL OR transcript_source IN ('audio_auto','audio_local','pasted'));
