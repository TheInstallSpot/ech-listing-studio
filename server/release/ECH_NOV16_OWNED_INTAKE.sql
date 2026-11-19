CREATE OR REPLACE FUNCTION private.ech_owned_nov16_intake_v32(p_sku text,p_brand text,p_part text,p_fulfillment text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
SELECT lower(coalesce(p_fulfillment,''))='ech' AND EXISTS(SELECT 1 FROM (VALUES
('NOV16-KEF-CI200RR-THX','KEF','CI200RRTHX'),
('NOV16-KEF-CI130QRFL','KEF','CI130QRFL'),
('NOV16-FOCAL-300-ICLCR5','FOCAL','300ICLCR5')
) approved(sku,brand,part) WHERE approved.sku=p_sku AND approved.brand=upper(regexp_replace(coalesce(p_brand,''),'[^a-zA-Z0-9]','','g')) AND approved.part=upper(regexp_replace(coalesce(p_part,''),'[^a-zA-Z0-9]','','g')));
$fn$;
REVOKE ALL ON FUNCTION private.ech_owned_nov16_intake_v32(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.ech_owned_nov16_intake_v32(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ech_review_allowed_v24(p_token_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t private.ech_review_tokens; brand text; part text; sku text; fulfillment text;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RETURN false; END IF;
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash AND used_at IS NULL AND expires_at>now();
 IF t.queue_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.ech_ready_products q
   WHERE q.id=t.queue_id AND q.status='ready' AND q.approved_at IS NOT NULL AND q.sku=t.sku)
   OR t.authorization_data->>'sku' IS DISTINCT FROM t.sku THEN RETURN false; END IF;
 brand:=upper(regexp_replace(coalesce(t.authorization_data->>'brand',''),'[^a-zA-Z0-9]','','g'));
 part:=upper(regexp_replace(coalesce(t.authorization_data->>'part',''),'[^a-zA-Z0-9]','','g'));
 sku:=upper(regexp_replace(t.sku,'[^a-zA-Z0-9]','','g'));
 fulfillment:=lower(coalesce(t.authorization_data->>'fulfillment',''));
 IF (brand IN ('FOCAL','DEFINITIVETECHNOLOGY','SONYES') OR t.sku ~* '^(FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]') AND NOT private.ech_owned_nov16_intake_v32(t.sku,brand,t.authorization_data->>'part',fulfillment) THEN RETURN false; END IF;
 IF (brand='KEF' OR t.sku ~* '^KEF[-_]') AND NOT (
   brand='KEF' AND (private.ech_kef_intake_exception_v27(t.sku,t.authorization_data->>'part',fulfillment) OR private.ech_owned_nov16_intake_v32(t.sku,brand,t.authorization_data->>'part',fulfillment))
 ) THEN RETURN false; END IF;
 IF brand='SONY' AND (part ~ 'ES$' OR t.sku ~* '(^|[-_])ES($|[-_])') THEN RETURN false; END IF;
 IF brand='SONANCE' AND (sku LIKE '%MAG%' OR part LIKE '%MAG%') THEN RETURN false; END IF;
 IF brand IN ('EPISODE','TRIAD') AND fulfillment='distributor' THEN RETURN false; END IF;
 IF brand='AUDIOQUEST' THEN
   IF sku NOT IN ('AUDIPHOTON48','AUDIPQ303BSTOCK','AUDIPQ303DEMO') THEN RETURN false; END IF;
   IF sku LIKE 'AUDIPQ303%' AND fulfillment<>'ech' THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.ech_pin_queue_v24(p_token text, p_logout boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE h text; result jsonb;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('error','unauthorized');
  END IF;
  h := encode(extensions.digest(p_token,'sha256'),'hex');
  IF NOT EXISTS(SELECT 1 FROM private.ech_pin_sessions s CROSS JOIN private.ech_pin_account a
    WHERE s.token_hash=h AND s.revoked_at IS NULL AND s.expires_at>now()
    AND a.enabled AND s.generation=a.generation) THEN
    RETURN jsonb_build_object('error','unauthorized');
  END IF;
  IF p_logout THEN
    UPDATE private.ech_pin_sessions SET revoked_at=now() WHERE token_hash=h;
    RETURN jsonb_build_object('ok',true);
  END IF;

  -- Only a valid PIN session can reach renewal. Preserve the existing token
  -- so in-flight work and stored photo references remain attached to the item.
  -- Never renew consumed, revoked-by-use, unapproved, retired or held jobs.
  UPDATE private.ech_review_tokens t SET expires_at=now()+interval '7 days'
  FROM public.ech_ready_products q
  WHERE q.id=t.queue_id AND q.status='ready' AND q.approved_at IS NOT NULL
    AND t.used_at IS NULL AND t.expires_at<=now()+interval '2 days'
    AND t.sku=q.sku AND t.authorization_data->>'sku'=q.sku
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(q.payload->'items') i
      WHERE i->>'sku'=q.sku AND i->>'reviewToken' ~ '^[a-f0-9]{64}$'
      AND encode(extensions.digest(i->>'reviewToken','sha256'),'hex')=t.token_hash)
    AND (
      (upper(regexp_replace(coalesce(t.authorization_data->>'brand',''),'[^a-zA-Z0-9]','','g'))
        NOT IN ('KEF','FOCAL','DEFINITIVETECHNOLOGY') AND q.sku !~* '^(KEF|FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]')
      OR (upper(regexp_replace(coalesce(t.authorization_data->>'brand',''),'[^a-zA-Z0-9]','','g'))='KEF'
        AND private.ech_kef_intake_exception_v27(q.sku,t.authorization_data->>'part',t.authorization_data->>'fulfillment'))
      OR private.ech_owned_nov16_intake_v32(q.sku,t.authorization_data->>'brand',t.authorization_data->>'part',t.authorization_data->>'fulfillment')
    );

  -- Preserve the existing private-field stripping and return contract.
  SELECT coalesce(jsonb_agg(jsonb_build_object('queueId',q.id,'recommendationId',q.recommendation_id,
    'sku',q.sku,'approvedAt',q.approved_at,'payload',jsonb_build_object('items',(
      SELECT coalesce(jsonb_agg(i - 'unitCost' - 'cost' - 'researchNotes' - 'targetPrice' - 'shippingPlan'),'[]'::jsonb)
      FROM jsonb_array_elements(q.payload->'items') i
    ))) ORDER BY q.approved_at),'[]'::jsonb) INTO result
  FROM (SELECT q.* FROM public.ech_ready_products q
    JOIN private.ech_review_tokens t ON t.queue_id=q.id
    WHERE q.status='ready' AND public.ech_review_allowed_v24(t.token_hash)
    ORDER BY q.approved_at LIMIT 100) q;
  RETURN jsonb_build_object('items',result);
END $function$;

