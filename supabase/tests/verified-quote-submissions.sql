BEGIN;
DO $$
DECLARE
  first_result jsonb;
  replay_result jsonb;
  request_payload jsonb := '{"full_name":"Isolated quote test","email":"quote@example.test","phone":"07000000000","postcode":"HD1 1AA","service_interest":"broadband","plan_preference":"not_sure","customer_type":"residential","preferred_contact_method":"email","marketing_consent":false,"source":"web"}';
  test_key text := encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
BEGIN
  first_result := public.save_quote_submission(test_key,repeat('b',64),request_payload,NULL);
  replay_result := public.save_quote_submission(test_key,repeat('b',64),request_payload,NULL);
  IF first_result->>'id' IS DISTINCT FROM replay_result->>'id' OR NOT (replay_result->>'replayed')::boolean THEN
    RAISE EXCEPTION 'Retry created a different request';
  END IF;
  BEGIN
    PERFORM public.save_quote_submission(test_key,repeat('c',64),request_payload,NULL);
    RAISE EXCEPTION 'Conflicting key was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF has_function_privilege('anon','public.save_quote_submission(text,text,jsonb,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.save_quote_submission(text,text,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Public caller can create a verified receipt';
  END IF;
END;
$$;
ROLLBACK;
