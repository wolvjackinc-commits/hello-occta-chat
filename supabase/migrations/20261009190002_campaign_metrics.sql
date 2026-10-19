-- Aggregate counters over the entire campaign inside PostgreSQL (no API row pagination limit).
CREATE OR REPLACE FUNCTION public.refresh_campaign_metrics(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.campaigns c SET
   sent_count=s.sent_count,
   delivered_count=s.delivered_count,
   opened_count=s.opened_count,
   bounced_count=s.bounced_count,
   failed_count=s.failed_count,
   status=CASE WHEN NOT s.has_pending AND c.status='sending' THEN 'completed' ELSE c.status END,
   completed_at=CASE WHEN NOT s.has_pending AND c.status='sending' THEN COALESCE(c.completed_at,now()) ELSE c.completed_at END,
   updated_at=now()
 FROM (
   SELECT
     count(*) FILTER(WHERE sent_at IS NOT NULL)::integer AS sent_count,
     count(*) FILTER(WHERE delivered_at IS NOT NULL)::integer AS delivered_count,
     count(*) FILTER(WHERE opened_at IS NOT NULL)::integer AS opened_count,
     count(*) FILTER(WHERE bounced_at IS NOT NULL)::integer AS bounced_count,
     count(*) FILTER(WHERE status='failed')::integer AS failed_count,
     count(*) FILTER(WHERE status IN ('queued','processing'))>0 AS has_pending
   FROM public.campaign_recipients WHERE campaign_id=p_campaign_id
 ) s WHERE c.id=p_campaign_id;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_campaign_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_campaign_metrics(uuid) TO service_role;
