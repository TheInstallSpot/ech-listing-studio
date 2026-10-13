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

