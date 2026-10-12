CREATE OR REPLACE FUNCTION public.ech_pin_login(p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a private.ech_pin_account%ROWTYPE; token text;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO a FROM private.ech_pin_account WHERE id FOR UPDATE;
  IF NOT FOUND OR NOT a.enabled THEN RETURN jsonb_build_object('error','not_ready'); END IF;
  IF a.failure_day <> CURRENT_DATE THEN
    UPDATE private.ech_pin_account SET failure_day=CURRENT_DATE, day_failures=0 WHERE id;
    a.day_failures := 0;
  END IF;
  IF a.day_failures >= 20 OR a.locked_until > now() THEN
    RETURN jsonb_build_object('error','locked');
  END IF;
  IF a.locked_until IS NOT NULL AND a.locked_until <= now() THEN
    a.failures := 0;
    UPDATE private.ech_pin_account SET failures=0, locked_until=NULL WHERE id;
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' OR
     extensions.crypt(p_pin,a.pin_hash) <> a.pin_hash THEN
    UPDATE private.ech_pin_account SET failures=a.failures+1, day_failures=a.day_failures+1,
      locked_until=CASE WHEN a.failures+1 >= 5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id;
    RETURN jsonb_build_object('error',CASE WHEN a.failures+1 >= 5 OR a.day_failures+1 >= 20 THEN 'locked' ELSE 'invalid_pin' END);
  END IF;
  token := encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO private.ech_pin_sessions(token_hash,generation)
    VALUES (encode(extensions.digest(token,'sha256'),'hex'),a.generation);
  UPDATE private.ech_pin_account SET failures=0, locked_until=NULL WHERE id;
  RETURN jsonb_build_object('token',token,'expiresInDays',30);
END $function$

