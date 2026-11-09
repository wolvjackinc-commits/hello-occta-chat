-- Care: cancel a sale from the Sales Desk, and permanently delete letters that were never sent
-- (on sale cancel and when a customer is deleted). Posted or emailed letters are kept: they are the
-- record of what the customer actually received.

-- Deletes never-sent letters (rows, queue entries and PDF files) for one subscription or one customer.
CREATE OR REPLACE FUNCTION public.care_purge_unsent_letters(p_sub uuid, p_customer uuid, p_keep_types text[] DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; n int := 0; key text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key');
BEGIN
  FOR l IN SELECT id, pdf_path, dedupe_key FROM public.care_letters
    WHERE ((p_sub IS NOT NULL AND subscription_id = p_sub) OR (p_customer IS NOT NULL AND customer_id = p_customer))
      AND posted_on IS NULL AND email_sent_at IS NULL AND mail_house_on IS NULL AND NOT (letter_type = ANY(p_keep_types))
  LOOP
    DELETE FROM public.care_outbox WHERE letter_id = l.id OR (l.dedupe_key IS NOT NULL AND dedupe_key = l.dedupe_key);
    DELETE FROM public.care_letters WHERE id = l.id;
    -- The PDF is removed through the Storage API after this transaction commits (pg_net queues the call).
    IF l.pdf_path IS NOT NULL AND key IS NOT NULL THEN
      PERFORM net.http_delete(url := 'https://oexgjmuvgdndizsufipe.supabase.co/storage/v1/object/care-documents/' || l.pdf_path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'apikey', key));
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.care_purge_unsent_letters(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Sales Desk: cancel a sale. Agents can cancel their own sales; supervisors any.
-- Nothing posted yet: cancel quietly and delete every letter. Something posted: normal cancellation
-- (the customer gets the cancellation letter) and only the unsent letters are deleted.
CREATE OR REPLACE FUNCTION public.care_sales_cancel(p_sale uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record; sub record; sent boolean; purged int := 0;
BEGIN
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'cancel_reason_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND OR (r <> 'supervisor' AND s.agent_id <> uid) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.status = 'withdrawn' THEN RAISE EXCEPTION 'already_cancelled'; END IF;
  IF s.subscription_id IS NOT NULL THEN
    SELECT * INTO sub FROM public.care_subscriptions WHERE id = s.subscription_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.care_collections WHERE subscription_id = sub.id AND status IN ('in_run','submitted','paid')) THEN
      RAISE EXCEPTION 'payment_already_in_progress: cancel it from Admin -> OCCTA Care so any payment is handled';
    END IF;
    sent := EXISTS (SELECT 1 FROM public.care_letters WHERE subscription_id = sub.id AND (posted_on IS NOT NULL OR email_sent_at IS NOT NULL OR mail_house_on IS NOT NULL));
    IF sub.status NOT IN ('cancelled','declined') THEN
      IF sent THEN
        PERFORM public.care_cancel_internal(sub.id, 'occta', 'Sale cancelled: ' || left(p_note, 500), 'staff', uid);
      ELSE
        UPDATE public.care_subscriptions SET status = 'cancelled', status_reason = 'sale_cancelled', cancelled_at = now(),
          cancel_effective_date = public.care_today(), cancel_channel = 'occta' WHERE id = sub.id;
        UPDATE public.care_mandates SET status = 'cancelled' WHERE subscription_id = sub.id AND status <> 'cancelled';
        UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'sale_cancelled'
         WHERE subscription_id = sub.id AND status IN ('scheduled','ready');
        UPDATE public.admin_tasks SET status = 'cancelled', updated_at = now()
         WHERE status IN ('open','in_progress') AND position(sub.reference IN coalesce(title, '') || ' ' || coalesce(description, '')) > 0;
      END IF;
    END IF;
    purged := public.care_purge_unsent_letters(sub.id, NULL, CASE WHEN sent THEN ARRAY['cancellation_confirmation'] ELSE '{}'::text[] END);
  END IF;
  UPDATE public.care_sales SET status = 'withdrawn', agent_notes = left(coalesce(agent_notes || E'\n', '') || 'Cancelled: ' || p_note, 2000) WHERE id = s.id;
  IF s.invite_id IS NOT NULL THEN
    UPDATE public.care_invites SET revoked_at = coalesce(revoked_at, now()), revoked_reason = coalesce(revoked_reason, 'sale cancelled') WHERE id = s.invite_id AND used_at IS NULL;
  END IF;
  PERFORM public.care_log(s.subscription_id, s.customer_id, 'staff', uid, 'care_sale_cancelled',
    jsonb_build_object('sale_id', s.id, 'note', left(p_note, 1000), 'letters_deleted', purged, 'customer_notified', coalesce(sent, false)));
  RETURN jsonb_build_object('ok', true, 'letters_deleted', purged, 'cancellation_letter', coalesce(sent, false));
END $$;
REVOKE ALL ON FUNCTION public.care_sales_cancel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_sales_cancel(uuid, text) TO authenticated, service_role;

-- Deleting a customer (admin_delete_customer stamps deleted_at) also deletes their never-sent Care letters.
CREATE OR REPLACE FUNCTION public.care_on_customer_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN PERFORM public.care_purge_unsent_letters(NULL, NEW.id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.care_on_customer_deleted() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS care_on_customer_deleted ON public.profiles;
CREATE TRIGGER care_on_customer_deleted AFTER UPDATE OF deleted_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.care_on_customer_deleted();

-- Customers already deleted: remove their never-sent Care letters too.
DO $do$ DECLARE p record; BEGIN
  FOR p IN SELECT id FROM public.profiles WHERE deleted_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.care_letters WHERE customer_id = profiles.id) LOOP
    PERFORM public.care_purge_unsent_letters(NULL, p.id);
  END LOOP;
END $do$;
