BEGIN;

-- Candidate only. No production execution. Gate every receiving write against
-- the exact approved physical job and retained channel restrictions.
CREATE OR REPLACE FUNCTION public.ech_review_allowed_v24(p_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
 IF brand IN ('KEF','FOCAL','DEFINITIVETECHNOLOGY','SONYES') OR t.sku ~* '^(KEF|FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]' THEN RETURN false; END IF;
 IF brand='SONY' AND (part ~ 'ES$' OR t.sku ~* '(^|[-_])ES($|[-_])') THEN RETURN false; END IF;
 IF brand='SONANCE' AND (sku LIKE '%MAG%' OR part LIKE '%MAG%') THEN RETURN false; END IF;
 IF brand IN ('EPISODE','TRIAD') AND fulfillment='distributor' THEN RETURN false; END IF;
 IF brand='AUDIOQUEST' THEN
   IF sku NOT IN ('AUDIPHOTON48','AUDIPQ303BSTOCK','AUDIPQ303DEMO') THEN RETURN false; END IF;
   IF sku LIKE 'AUDIPQ303%' AND fulfillment<>'ech' THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.ech_review_allowed_v24(text) FROM PUBLIC;


CREATE OR REPLACE FUNCTION public.accept_ech_listing_review_v24(p_token_hash text, p_review_id uuid, p_listing jsonb, p_photos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token private.ech_review_tokens; v_item jsonb; v_title text; v_count integer;
begin
  if not public.ech_review_allowed_v24(p_token_hash) then raise exception 'review authorization unavailable'; end if;
  select * into v_token from private.ech_review_tokens where token_hash=p_token_hash for update;
  if v_token.queue_id is null or v_token.used_at is not null or v_token.expires_at<=now() then
    raise exception 'review token is missing, expired, or already used';
  end if;
  if not exists(select 1 from public.ech_ready_products q where q.id=v_token.queue_id and q.status='ready' and q.sku=v_token.sku) then
    raise exception 'queued item is no longer available';
  end if;
  v_item:=p_listing->'item'; v_title:=btrim(coalesce(p_listing->>'ebayTitle',''));
  v_count:=jsonb_array_length(coalesce(p_photos,'[]'::jsonb));
  if coalesce((p_listing->>'schemaVersion')::integer,0)<>1
     or p_listing->>'reviewStatus'<>'awaiting_lee_approval'
     or v_item->>'sku' is distinct from v_token.sku
     or p_listing->>'queueId' is distinct from v_token.queue_id::text
     or coalesce(v_item->>'cond','') not in ('N1','O2','D3')
     or v_item->'quantityConfirmed' is distinct from 'true'::jsonb
     or v_item->>'sold' is distinct from v_token.authorization_data->>'saleUnitLabel'
     or (v_item->>'availableQuantity')::integer is distinct from (v_token.authorization_data->>'availableQuantity')::integer
     or v_item->>'fulfillment' is distinct from v_token.authorization_data->>'fulfillment'
     or (v_item->>'targetPrice')::numeric is distinct from (v_token.authorization_data->>'targetPrice')::numeric
     or v_item->>'ebayCategoryId' is distinct from v_token.authorization_data->>'ebayCategoryId'
     or v_item ? 'unitCost' or v_item ? 'estimatedContribution'
     or char_length(v_title) not between 1 and 80
     or coalesce(jsonb_array_length(v_item->'box'),0)<1
     or coalesce(jsonb_array_length(v_item->'ver'),0)<1
     or coalesce(p_listing->>'descriptionHtml','')=''
     or v_count not between 1 and 24
     or v_count<>coalesce(jsonb_array_length(p_listing->'photoManifest'),-1) then
    raise exception 'listing packet does not match the approved queue item';
  end if;
  if exists(select 1 from jsonb_array_elements(p_photos) photo
    where photo->>'mimeType'<>'image/jpeg'
       or coalesce((photo->>'sizeBytes')::integer,0) not between 1 and 12582912
       or coalesce((photo->>'width')::integer,0)<=0
       or coalesce((photo->>'height')::integer,0)<=0
       or coalesce(photo->>'sha256','') !~ '^[0-9a-f]{64}$'
       or coalesce(photo->>'storagePath','')='') then
    raise exception 'photo metadata is invalid';
  end if;
  insert into public.ech_listing_reviews(
    id,queue_id,recommendation_id,sku,schema_version,review_status,listing,
    condition_code,ebay_title,sale_unit,unit_cost,available_quantity,
    target_price,fulfillment_type,photo_count,warnings)
  values(p_review_id,v_token.queue_id,v_token.recommendation_id,v_token.sku,1,
    'awaiting_lee_approval',p_listing,v_item->>'cond',v_title,
    v_token.authorization_data->>'saleUnit',(v_token.authorization_data->>'unitCost')::numeric,
    (v_token.authorization_data->>'availableQuantity')::integer,
    (v_token.authorization_data->>'targetPrice')::numeric,
    v_token.authorization_data->>'fulfillment',v_count,
    coalesce(p_listing->'warnings','[]'::jsonb)||coalesce(p_listing->'issues','[]'::jsonb));
  insert into public.ech_listing_review_photos(
    review_id,display_order,storage_path,original_name,mime_type,size_bytes,sha256,width,height)
  select p_review_id,(photo->>'displayOrder')::integer,photo->>'storagePath',
    photo->>'originalName',photo->>'mimeType',(photo->>'sizeBytes')::integer,
    photo->>'sha256',(photo->>'width')::integer,(photo->>'height')::integer
  from jsonb_array_elements(p_photos) photo;
  insert into public.ech_listing_audit_log(review_id,action,actor_id,submitted_values,result_status,detail)
  values(p_review_id,'received','paige-listing-studio',
    jsonb_build_object('sku',v_token.sku,'condition',v_item->>'cond','saleUnit',v_item->>'sold',
      'unitCost',v_token.authorization_data->>'unitCost',
      'quantity',v_token.authorization_data->>'availableQuantity',
      'price',v_token.authorization_data->>'targetPrice',
      'fulfillment',v_token.authorization_data->>'fulfillment','title',v_title,'photoCount',v_count),
    'awaiting_lee_approval','{}'::jsonb);
  update private.ech_review_tokens set used_at=now() where queue_id=v_token.queue_id;
  update public.ech_ready_products set status='completed',completed_at=now(),
    output=jsonb_build_object('reviewId',p_review_id,'status','awaiting_lee_approval'),
    payload=jsonb_set(payload,'{items,0}',coalesce(payload#>'{items,0}','{}'::jsonb)-'reviewToken',false)
  where id=v_token.queue_id;
  return jsonb_build_object('reviewId',p_review_id,'status','awaiting_lee_approval');
end; $function$



CREATE OR REPLACE FUNCTION public.ech_draft_state_v24(p_token_hash text, p_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t private.ech_review_tokens; saved jsonb;
BEGIN
 IF NOT public.ech_review_allowed_v24(p_token_hash) THEN RAISE EXCEPTION 'draft authorization unavailable'; END IF;
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash AND used_at IS NULL AND expires_at>now();
 IF t.queue_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.ech_ready_products WHERE id=t.queue_id AND status='ready') THEN
  RAISE EXCEPTION 'draft authorization unavailable';
 END IF;
 IF p_snapshot IS NOT NULL THEN
  IF jsonb_typeof(p_snapshot)<>'object' OR octet_length(p_snapshot::text)>262144 THEN RAISE EXCEPTION 'invalid draft'; END IF;
  IF p_snapshot#>>'{item,sku}' IS DISTINCT FROM t.sku THEN RAISE EXCEPTION 'different SKU'; END IF;
  IF jsonb_typeof(p_snapshot->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(p_snapshot->'photos')>24 THEN RAISE EXCEPTION 'invalid photos'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_snapshot->'photos') p WHERE
    coalesce(p->>'storagePath','') NOT LIKE t.sku||'/drafts/'||t.queue_id::text||'/%') THEN RAISE EXCEPTION 'different photo owner'; END IF;
  p_snapshot:=jsonb_set(p_snapshot,'{item}',(p_snapshot->'item')-'reviewToken'-'unitCost'-'estimatedContribution');
  INSERT INTO private.ech_photo_drafts(queue_id,snapshot) VALUES(t.queue_id,p_snapshot)
    ON CONFLICT(queue_id) DO UPDATE SET snapshot=excluded.snapshot,updated_at=now();
 END IF;
 SELECT snapshot INTO saved FROM private.ech_photo_drafts WHERE queue_id=t.queue_id;
 RETURN coalesce(saved,'{}'::jsonb);
END $function$



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
    AND upper(regexp_replace(coalesce(t.authorization_data->>'brand',''),'[^a-zA-Z0-9]','','g'))
      NOT IN ('KEF','FOCAL','DEFINITIVETECHNOLOGY')
    AND q.sku !~* '^(KEF|FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]';

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
END $function$



CREATE OR REPLACE FUNCTION public.inspect_ech_review_token_v24(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token private.ech_review_tokens;
begin
  if not public.ech_review_allowed_v24(p_token_hash) then return null; end if;
  select * into v_token
  from private.ech_review_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now();

  if v_token.queue_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'queueId', v_token.queue_id,
    'recommendationId', v_token.recommendation_id,
    'sku', v_token.sku,
    'authorization', v_token.authorization_data,
    'expiresAt', v_token.expires_at
  );
end;
$function$



-- Additive v24 receive-only interface; publication functions are unchanged.
REVOKE ALL ON FUNCTION public.inspect_ech_review_token_v24(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ech_draft_state_v24(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_ech_listing_review_v24(text,uuid,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ech_pin_queue_v24(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_ech_review_token_v24(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ech_draft_state_v24(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_ech_listing_review_v24(text,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ech_pin_queue_v24(text,boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
